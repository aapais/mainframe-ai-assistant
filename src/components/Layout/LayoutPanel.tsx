/**
 * LayoutPanel Component
 * Collapsible/expandable panel component with accessibility and animation support
 */

import React, { useState, useCallback, useMemo, useRef, useEffect, ReactNode } from 'react';
import { BaseComponentProps } from '../types/BaseComponent';
import { smartMemo } from '../performance/PerformanceOptimizer';

// =========================
// TYPE DEFINITIONS
// =========================

export interface LayoutPanelProps extends BaseComponentProps {
  /** Panel title */
  title?: string;

  /** Panel header content (overrides title) */
  header?: ReactNode;

  /** Panel content */
  children: ReactNode;

  /** Panel footer content */
  footer?: ReactNode;

  /** Initial collapsed state */
  defaultCollapsed?: boolean;

  /** Controlled collapsed state */
  collapsed?: boolean;

  /** Collapse/expand callback */
  onToggle?: (collapsed: boolean) => void;

  /** Enable collapsible functionality */
  collapsible?: boolean;

  /** Panel variant */
  variant?: 'default' | 'bordered' | 'outlined' | 'elevated' | 'flush';

  /** Panel size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';

  /** Panel position when used as overlay */
  position?: 'left' | 'right' | 'top' | 'bottom';

  /** Enable resizable panel */
  resizable?: boolean;

  /** Initial width (for side panels) */
  defaultWidth?: string;

  /** Initial height (for top/bottom panels) */
  defaultHeight?: string;

  /** Minimum size constraints */
  minWidth?: string;
  minHeight?: string;

  /** Maximum size constraints */
  maxWidth?: string;
  maxHeight?: string;

  /** Animation duration in ms */
  animationDuration?: number;

  /** Disable animations */
  noAnimation?: boolean;

  /** Panel background */
  background?: 'default' | 'white' | 'gray' | 'transparent';

  /** Enable shadow */
  shadow?: boolean;

  /** Panel padding */
  padding?: 'none' | 'sm' | 'md' | 'lg';

  /** Panel border radius */
  borderRadius?: 'none' | 'sm' | 'md' | 'lg';

  /** Header actions (buttons, etc.) */
  headerActions?: ReactNode;

  /** Show collapse indicator */
  showCollapseIndicator?: boolean;

  /** Collapse indicator position */
  collapseIndicatorPosition?: 'left' | 'right';

  /** Custom collapse button */
  customCollapseButton?: (collapsed: boolean, toggle: () => void) => ReactNode;

  /** Enable keyboard navigation */
  keyboardNavigation?: boolean;

  /** Focus management */
  autoFocus?: boolean;

  /** Trap focus inside panel when expanded */
  trapFocus?: boolean;
}

// =========================
// HOOKS
// =========================

/**
 * Panel state management hook
 */
const usePanelState = (
  defaultCollapsed: boolean = false,
  controlled?: boolean,
  controlledValue?: boolean,
  onToggle?: (collapsed: boolean) => void
) => {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isControlled = controlled !== undefined;
  const collapsed = isControlled ? controlledValue! : internalCollapsed;

  const toggle = useCallback(() => {
    const newCollapsed = !collapsed;
    if (!isControlled) {
      setInternalCollapsed(newCollapsed);
    }
    onToggle?.(newCollapsed);
  }, [collapsed, isControlled, onToggle]);

  return { collapsed, toggle };
};

/**
 * Resize functionality hook
 */
const useResizable = (
  enabled: boolean,
  position: LayoutPanelProps['position'],
  defaultWidth?: string,
  defaultHeight?: string,
  minWidth?: string,
  minHeight?: string,
  maxWidth?: string,
  maxHeight?: string
) => {
  const [dimensions, setDimensions] = useState({
    width: defaultWidth || 'auto',
    height: defaultHeight || 'auto'
  });

  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartDimensions = useRef({ width: 0, height: 0 });

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!enabled) return;

    setIsResizing(true);
    resizeStartPos.current = { x: e.clientX, y: e.clientY };

    // Get current dimensions
    const rect = (e.target as HTMLElement).closest('.layout-panel')?.getBoundingClientRect();
    if (rect) {
      resizeStartDimensions.current = { width: rect.width, height: rect.height };
    }

    e.preventDefault();
  }, [enabled]);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStartPos.current.x;
    const deltaY = e.clientY - resizeStartPos.current.y;

    const newWidth = resizeStartDimensions.current.width + (position === 'right' ? -deltaX : deltaX);
    const newHeight = resizeStartDimensions.current.height + (position === 'bottom' ? -deltaY : deltaY);

    // Apply constraints
    const constrainedWidth = Math.max(
      minWidth ? parseInt(minWidth) : 200,
      Math.min(maxWidth ? parseInt(maxWidth) : 800, newWidth)
    );

    const constrainedHeight = Math.max(
      minHeight ? parseInt(minHeight) : 100,
      Math.min(maxHeight ? parseInt(maxHeight) : 600, newHeight)
    );

    setDimensions({
      width: position === 'left' || position === 'right' ? `${constrainedWidth}px` : dimensions.width,
      height: position === 'top' || position === 'bottom' ? `${constrainedHeight}px` : dimensions.height
    });
  }, [isResizing, position, minWidth, minHeight, maxWidth, maxHeight, dimensions]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Mouse event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = position === 'left' || position === 'right' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleResize, handleResizeEnd, position]);

  return {
    dimensions,
    isResizing,
    handleResizeStart
  };
};

// =========================
// STYLE UTILITIES
// =========================

const getPanelClasses = (props: LayoutPanelProps, collapsed: boolean) => {
  const {
    variant = 'default',
    size = 'md',
    background = 'default',
    shadow = false,
    padding = 'md',
    borderRadius = 'md',
    noAnimation = false
  } = props;

  const classes = ['layout-panel', 'flex', 'flex-col'];

  // Variant styles
  const variantMap = {
    default: 'bg-white',
    bordered: 'bg-white border border-gray-200',
    outlined: 'bg-transparent border border-gray-300',
    elevated: 'bg-white shadow-lg',
    flush: 'bg-transparent'
  };
  classes.push(variantMap[variant]);

  // Background overrides
  const backgroundMap = {
    default: '',
    white: 'bg-white',
    gray: 'bg-gray-50',
    transparent: 'bg-transparent'
  };
  if (background !== 'default') {
    classes.push(backgroundMap[background]);
  }

  // Shadow
  if (shadow && variant !== 'elevated') {
    classes.push('shadow-sm');
  }

  // Border radius
  const radiusMap = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg'
  };
  classes.push(radiusMap[borderRadius]);

  // Size (affects max dimensions)
  const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'w-full'
  };
  if (size !== 'full') {
    classes.push(sizeMap[size]);
  }

  // Padding
  const paddingMap = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };
  if (padding !== 'none') {
    classes.push(paddingMap[padding]);
  }

  // Animations
  if (!noAnimation) {
    classes.push('transition-all', 'duration-300', 'ease-in-out');
  }

  // Collapsed state
  if (collapsed) {
    classes.push('panel-collapsed');
  }

  return classes.join(' ');
};

const getResizeHandleClasses = (position: LayoutPanelProps['position']) => {
  const baseClasses = [
    'resize-handle',
    'absolute',
    'bg-gray-200',
    'hover:bg-blue-500',
    'transition-colors',
    'duration-200'
  ];

  switch (position) {
    case 'left':
      return [...baseClasses, 'right-0', 'top-0', 'w-1', 'h-full', 'cursor-col-resize'].join(' ');
    case 'right':
      return [...baseClasses, 'left-0', 'top-0', 'w-1', 'h-full', 'cursor-col-resize'].join(' ');
    case 'top':
      return [...baseClasses, 'bottom-0', 'left-0', 'w-full', 'h-1', 'cursor-row-resize'].join(' ');
    case 'bottom':
      return [...baseClasses, 'top-0', 'left-0', 'w-full', 'h-1', 'cursor-row-resize'].join(' ');
    default:
      return baseClasses.join(' ');
  }
};

// =========================
// COMPONENTS
// =========================

/**
 * Panel Header Component
 */
const PanelHeader: React.FC<{
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  showIndicator?: boolean;
  indicatorPosition?: 'left' | 'right';
  customCollapseButton?: (collapsed: boolean, toggle: () => void) => ReactNode;
}> = ({
  title,
  children,
  actions,
  collapsible = false,
  collapsed = false,
  onToggle,
  showIndicator = true,
  indicatorPosition = 'right',
  customCollapseButton
}) => {
  if (!title && !children) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && collapsible) {
      e.preventDefault();
      onToggle?.();
    }
  };

  const collapseButton = customCollapseButton ? (
    customCollapseButton(collapsed, onToggle || (() => {}))
  ) : collapsible ? (
    <button
      type="button"
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className="p-1 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
      aria-expanded={!collapsed}
      data-testid="panel-toggle"
    >
      <svg
        className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-0' : 'rotate-90'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  ) : null;

  return (
    <div className="panel-header flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center flex-1 min-w-0">
        {showIndicator && indicatorPosition === 'left' && collapseButton}
        <div className="flex-1 min-w-0">
          {children || <h3 className="text-sm font-medium text-gray-900 truncate">{title}</h3>}
        </div>
        {showIndicator && indicatorPosition === 'right' && collapseButton}
      </div>
      {actions && <div className="ml-3 flex items-center space-x-2">{actions}</div>}
    </div>
  );
};

/**
 * Panel Content Component
 */
const PanelContent: React.FC<{
  children: ReactNode;
  collapsed?: boolean;
  noAnimation?: boolean;
  animationDuration?: number;
}> = ({ children, collapsed = false, noAnimation = false, animationDuration = 300 }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');

  // Handle collapse animation
  useEffect(() => {
    if (noAnimation || !contentRef.current) return;

    const element = contentRef.current;
    const scrollHeight = element.scrollHeight;

    if (collapsed) {
      setHeight(scrollHeight);
      requestAnimationFrame(() => {
        setHeight(0);
      });
    } else {
      setHeight(scrollHeight);
      const timer = setTimeout(() => {
        setHeight('auto');
      }, animationDuration);

      return () => clearTimeout(timer);
    }
  }, [collapsed, noAnimation, animationDuration]);

  const contentStyles = useMemo(() => ({
    height: noAnimation ? (collapsed ? 0 : 'auto') : height,
    overflow: height === 'auto' ? 'visible' : 'hidden',
    transition: noAnimation ? 'none' : `height ${animationDuration}ms ease-in-out`
  }), [height, noAnimation, animationDuration, collapsed]);

  return (
    <div
      ref={contentRef}
      className="panel-content"
      style={contentStyles}
      aria-hidden={collapsed}
    >
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

/**
 * Panel Footer Component
 */
const PanelFooter: React.FC<{
  children: ReactNode;
}> = ({ children }) => (
  <div className="panel-footer px-4 py-3 border-t border-gray-200 bg-gray-50">
    {children}
  </div>
);

// =========================
// MAIN COMPONENT
// =========================

export const LayoutPanel = smartMemo<LayoutPanelProps>(
  ({
    title,
    header,
    children,
    footer,
    defaultCollapsed = false,
    collapsed: controlledCollapsed,
    onToggle,
    collapsible = false,
    variant = 'default',
    size = 'md',
    position,
    resizable = false,
    defaultWidth,
    defaultHeight,
    minWidth = '200px',
    minHeight = '100px',
    maxWidth = '800px',
    maxHeight = '600px',
    animationDuration = 300,
    noAnimation = false,
    background = 'default',
    shadow = false,
    padding = 'md',
    borderRadius = 'md',
    headerActions,
    showCollapseIndicator = true,
    collapseIndicatorPosition = 'right',
    customCollapseButton,
    keyboardNavigation = true,
    autoFocus = false,
    trapFocus = false,
    className = '',
    style,
    'data-testid': testId,
    ...restProps
  }) => {
    // Panel state
    const { collapsed, toggle } = usePanelState(
      defaultCollapsed,
      controlledCollapsed !== undefined,
      controlledCollapsed,
      onToggle
    );

    // Resize functionality
    const { dimensions, isResizing, handleResizeStart } = useResizable(
      resizable,
      position,
      defaultWidth,
      defaultHeight,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight
    );

    // Panel ref for focus management
    const panelRef = useRef<HTMLDivElement>(null);

    // Auto focus
    useEffect(() => {
      if (autoFocus && panelRef.current) {
        panelRef.current.focus();
      }
    }, [autoFocus]);

    // Keyboard navigation
    useEffect(() => {
      if (!keyboardNavigation || !panelRef.current) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && collapsed === false && collapsible) {
          toggle();
        }
      };

      const element = panelRef.current;
      element.addEventListener('keydown', handleKeyDown);
      return () => element.removeEventListener('keydown', handleKeyDown);
    }, [keyboardNavigation, collapsed, collapsible, toggle]);

    // Panel classes and styles
    const panelClasses = useMemo(() => {
      const base = getPanelClasses(
        { variant, size, background, shadow, padding, borderRadius, noAnimation },
        collapsed
      );
      return className ? `${base} ${className}` : base;
    }, [variant, size, background, shadow, padding, borderRadius, noAnimation, collapsed, className]);

    const panelStyles = useMemo(() => ({
      ...style,
      ...(resizable && {
        width: dimensions.width,
        height: dimensions.height,
        position: 'relative' as const
      })
    }), [style, resizable, dimensions]);

    return (
      <div
        ref={panelRef}
        className={panelClasses}
        style={panelStyles}
        data-testid={testId}
        data-collapsed={collapsed}
        data-resizable={resizable}
        data-resizing={isResizing}
        tabIndex={keyboardNavigation ? 0 : undefined}
        role={collapsible ? 'button' : 'group'}
        aria-expanded={collapsible ? !collapsed : undefined}
        aria-label={title}
        {...restProps}
      >
        {/* Header */}
        <PanelHeader
          title={title}
          actions={headerActions}
          collapsible={collapsible}
          collapsed={collapsed}
          onToggle={toggle}
          showIndicator={showCollapseIndicator}
          indicatorPosition={collapseIndicatorPosition}
          customCollapseButton={customCollapseButton}
        >
          {header}
        </PanelHeader>

        {/* Content */}
        <PanelContent
          collapsed={collapsed}
          noAnimation={noAnimation}
          animationDuration={animationDuration}
        >
          {children}
        </PanelContent>

        {/* Footer */}
        {footer && !collapsed && (
          <PanelFooter>{footer}</PanelFooter>
        )}

        {/* Resize Handle */}
        {resizable && position && (
          <div
            className={getResizeHandleClasses(position)}
            onMouseDown={handleResizeStart}
            data-testid="resize-handle"
          />
        )}
      </div>
    );
  },
  {
    compareProps: ['collapsed', 'variant', 'size', 'resizable'],
    monitor: process.env.NODE_ENV === 'development'
  }
);

LayoutPanel.displayName = 'LayoutPanel';

// =========================
// PANEL VARIANTS
// =========================

export const CollapsiblePanel: React.FC<Omit<LayoutPanelProps, 'collapsible'>> = (props) => (
  <LayoutPanel collapsible {...props} />
);

export const ResizablePanel: React.FC<Omit<LayoutPanelProps, 'resizable'>> = (props) => (
  <LayoutPanel resizable {...props} />
);

export const SidePanel: React.FC<LayoutPanelProps & { side: 'left' | 'right' }> = ({
  side,
  ...props
}) => (
  <LayoutPanel
    position={side}
    resizable
    defaultWidth="300px"
    {...props}
  />
);

export const InfoPanel: React.FC<Omit<LayoutPanelProps, 'variant'>> = (props) => (
  <LayoutPanel variant="outlined" shadow {...props} />
);

export default LayoutPanel;