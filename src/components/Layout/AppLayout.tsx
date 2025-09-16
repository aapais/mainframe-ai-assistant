/**
 * AppLayout Component
 * Main application layout wrapper with responsive behavior
 */

import React, { useState, useCallback, useMemo, ReactNode } from 'react';
import { BaseComponentProps } from '../types/BaseComponent';
import { smartMemo } from '../performance/PerformanceOptimizer';

// =========================
// TYPE DEFINITIONS
// =========================

export interface AppLayoutProps extends BaseComponentProps {
  /** Header component */
  header?: ReactNode;

  /** Sidebar component */
  sidebar?: ReactNode;

  /** Main content */
  children: ReactNode;

  /** Footer component */
  footer?: ReactNode;

  /** Sidebar initial collapsed state */
  sidebarCollapsed?: boolean;

  /** Enable sidebar toggle */
  sidebarToggleable?: boolean;

  /** Sidebar collapse/expand callback */
  onSidebarToggle?: (collapsed: boolean) => void;

  /** Layout variant */
  variant?: 'default' | 'full-width' | 'centered';

  /** Enable responsive behavior */
  responsive?: boolean;

  /** Container width constraint */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

  /** Padding configuration */
  padding?: 'none' | 'sm' | 'md' | 'lg';

  /** Background color */
  backgroundColor?: string;

  /** Enable scroll restoration */
  scrollRestoration?: boolean;
}

// =========================
// HOOKS
// =========================

/**
 * Responsive behavior hook for layout management
 */
const useResponsiveLayout = (responsive: boolean = true) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (!responsive) return;

    const updateLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setWindowSize({ width, height });
      setIsMobile(width < 640);
      setIsTablet(width >= 640 && width < 1024);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [responsive]);

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    windowSize
  };
};

/**
 * Sidebar state management hook
 */
const useSidebarState = (
  initialCollapsed: boolean = false,
  toggleable: boolean = true,
  onToggle?: (collapsed: boolean) => void
) => {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = useCallback(() => {
    if (!toggleable) return;

    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onToggle?.(newCollapsed);
  }, [collapsed, toggleable, onToggle]);

  return {
    collapsed,
    setCollapsed,
    toggle
  };
};

// =========================
// STYLE UTILITIES
// =========================

const getLayoutClasses = (props: AppLayoutProps, responsiveState: any) => {
  const { variant = 'default', maxWidth = 'xl', padding = 'md' } = props;
  const { isMobile, isTablet } = responsiveState;

  const baseClasses = ['app-layout', 'min-h-screen'];

  // Responsive layout classes
  if (isMobile) {
    baseClasses.push('grid-template-mobile');
  } else if (isTablet) {
    baseClasses.push('grid-template-tablet');
  } else {
    baseClasses.push('grid-template-desktop');
  }

  // Variant classes
  switch (variant) {
    case 'full-width':
      baseClasses.push('container-full');
      break;
    case 'centered':
      baseClasses.push('container', `container-${maxWidth}`, 'mx-auto');
      break;
    default:
      baseClasses.push('container', `container-${maxWidth}`);
  }

  // Padding classes using design system tokens
  if (padding !== 'none') {
    const paddingMap = {
      sm: 'p-space-layout-xs',
      md: 'p-space-layout-sm',
      lg: 'p-space-layout-md'
    };
    baseClasses.push(paddingMap[padding]);
  }

  return baseClasses.join(' ');
};

const getSidebarClasses = (collapsed: boolean, responsive: any) => {
  const { isMobile } = responsive;
  const classes = ['app-sidebar', 'transition-all', 'duration-300', 'ease-in-out'];

  if (isMobile) {
    classes.push(
      'fixed', 'inset-y-0', 'left-0', 'z-50',
      'transform', collapsed ? '-translate-x-full' : 'translate-x-0'
    );
  } else {
    classes.push(collapsed ? 'sidebar-collapsed' : 'sidebar-expanded');
  }

  return classes.join(' ');
};

// =========================
// COMPONENTS
// =========================

/**
 * Layout Header Component
 */
const LayoutHeader: React.FC<{
  children?: ReactNode;
  onSidebarToggle?: () => void;
  showToggle?: boolean;
  isMobile?: boolean;
}> = ({ children, onSidebarToggle, showToggle = true, isMobile = false }) => (
  <header className="app-header bg-surface-elevated border-b border-border-default px-space-layout-sm py-space-component-md">
    <div className="flex items-center justify-between h-full">
      {showToggle && (
        <button
          type="button"
          onClick={onSidebarToggle}
          className="inline-flex items-center justify-center p-space-component-sm rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-border-focus transition-colors duration-normal"
          aria-label="Toggle sidebar"
          data-testid="sidebar-toggle"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}

      <div className="flex-1 px-space-component-md">
        {children}
      </div>
    </div>
  </header>
);

/**
 * Layout Sidebar Component
 */
const LayoutSidebar: React.FC<{
  children?: ReactNode;
  collapsed?: boolean;
  isMobile?: boolean;
  onOverlayClick?: () => void;
}> = ({ children, collapsed = false, isMobile = false, onOverlayClick }) => (
  <>
    {/* Mobile overlay */}
    {isMobile && !collapsed && (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onOverlayClick}
        data-testid="mobile-sidebar-overlay"
      />
    )}

    {/* Sidebar */}
    <aside className={getSidebarClasses(collapsed, { isMobile })}>
      <div className="h-full bg-surface-base border-r border-border-default">
        <div className="p-space-component-md">
          {children}
        </div>
      </div>
    </aside>
  </>
);

/**
 * Layout Main Content Component
 */
const LayoutMain: React.FC<{
  children: ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <main className={`app-main overflow-hidden ${className}`}>
    <div className="h-full">
      {children}
    </div>
  </main>
);

/**
 * Layout Footer Component
 */
const LayoutFooter: React.FC<{
  children?: ReactNode;
}> = ({ children }) => (
  <footer className="app-footer bg-surface-base border-t border-border-subtle px-space-layout-sm py-space-component-sm">
    <div className="flex items-center justify-between text-sm text-text-tertiary">
      {children}
    </div>
  </footer>
);

// =========================
// MAIN COMPONENT
// =========================

export const AppLayout = smartMemo<AppLayoutProps>(
  ({
    header,
    sidebar,
    children,
    footer,
    sidebarCollapsed = false,
    sidebarToggleable = true,
    onSidebarToggle,
    variant = 'default',
    responsive = true,
    maxWidth = 'xl',
    padding = 'md',
    backgroundColor,
    scrollRestoration = true,
    className = '',
    style,
    'data-testid': testId,
    ...restProps
  }) => {
    // Responsive layout state
    const responsiveState = useResponsiveLayout(responsive);
    const { isMobile, isTablet } = responsiveState;

    // Sidebar state management
    const sidebarState = useSidebarState(
      sidebarCollapsed || isMobile, // Auto-collapse on mobile
      sidebarToggleable,
      onSidebarToggle
    );

    // Handle sidebar toggle for mobile overlay
    const handleSidebarToggle = useCallback(() => {
      sidebarState.toggle();
    }, [sidebarState.toggle]);

    // Handle mobile overlay click
    const handleOverlayClick = useCallback(() => {
      if (isMobile && !sidebarState.collapsed) {
        sidebarState.setCollapsed(true);
      }
    }, [isMobile, sidebarState]);

    // Layout classes
    const layoutClasses = useMemo(() => {
      const base = getLayoutClasses({ variant, maxWidth, padding }, responsiveState);
      return className ? `${base} ${className}` : base;
    }, [variant, maxWidth, padding, responsiveState, className]);

    // Scroll restoration
    React.useEffect(() => {
      if (scrollRestoration && 'scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'auto';
      }
    }, [scrollRestoration]);

    // CSS custom properties for dynamic styling
    const layoutStyle = useMemo(() => ({
      ...style,
      ...(backgroundColor && { '--layout-bg-color': backgroundColor }),
      ...(sidebarState.collapsed && { '--sidebar-width': 'var(--sidebar-width-collapsed)' })
    }), [style, backgroundColor, sidebarState.collapsed]);

    return (
      <div
        className={layoutClasses}
        style={layoutStyle}
        data-testid={testId}
        data-layout-variant={variant}
        data-sidebar-collapsed={sidebarState.collapsed}
        data-responsive={responsive}
        {...restProps}
      >
        {/* Header */}
        {header && (
          <LayoutHeader
            onSidebarToggle={handleSidebarToggle}
            showToggle={sidebarToggleable && (sidebar || isMobile)}
            isMobile={isMobile}
          >
            {header}
          </LayoutHeader>
        )}

        {/* Sidebar */}
        {sidebar && (
          <LayoutSidebar
            collapsed={sidebarState.collapsed}
            isMobile={isMobile}
            onOverlayClick={handleOverlayClick}
          >
            {sidebar}
          </LayoutSidebar>
        )}

        {/* Main Content */}
        <LayoutMain className={sidebar ? '' : 'col-span-full'}>
          {children}
        </LayoutMain>

        {/* Footer */}
        {footer && (
          <LayoutFooter>
            {footer}
          </LayoutFooter>
        )}
      </div>
    );
  },
  {
    compareProps: ['variant', 'maxWidth', 'padding', 'sidebarCollapsed'],
    monitor: process.env.NODE_ENV === 'development'
  }
);

AppLayout.displayName = 'AppLayout';

// =========================
// EXPORT VARIANTS
// =========================

export const FullWidthLayout: React.FC<Omit<AppLayoutProps, 'variant'>> = (props) => (
  <AppLayout variant="full-width" {...props} />
);

export const CenteredLayout: React.FC<Omit<AppLayoutProps, 'variant'>> = (props) => (
  <AppLayout variant="centered" {...props} />
);

export default AppLayout;