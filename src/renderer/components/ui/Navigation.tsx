import React, { forwardRef, useState, useEffect, useRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/className';

// Tabs Components
const tabsListVariants = cva(
  'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        pills: 'bg-transparent gap-1',
        underline: 'bg-transparent border-b border-border',
        card: 'bg-card border border-border rounded-lg'
      },
      size: {
        sm: 'h-8 text-xs',
        md: 'h-10 text-sm',
        lg: 'h-12 text-base'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
);

const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        pills: 'rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-muted hover:text-muted-foreground',
        underline: 'rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:bg-muted',
        card: 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-muted'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
}

const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ className, value, defaultValue, onValueChange, orientation = 'horizontal', ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(value || defaultValue || '');
    
    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    const handleValueChange = (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    };

    return (
      <div
        ref={ref}
        className={cn(
          'w-full',
          orientation === 'vertical' && 'flex gap-4',
          className
        )}
        data-orientation={orientation}
        {...props}
      >
        {React.Children.map(props.children, child => 
          React.isValidElement(child) 
            ? React.cloneElement(child, { 
                value: internalValue, 
                onValueChange: handleValueChange,
                orientation 
              } as any)
            : child
        )}
      </div>
    );
  }
);
Tabs.displayName = 'Tabs';

export interface TabsListProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tabsListVariants> {
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
}

const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, variant, size, value, onValueChange, orientation, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      aria-orientation={orientation}
      className={cn(
        tabsListVariants({ variant, size }),
        orientation === 'vertical' && 'flex-col h-auto w-auto',
        className
      )}
      {...props}
    >
      {React.Children.map(props.children, child =>
        React.isValidElement(child)
          ? React.cloneElement(child, {
              variant,
              value,
              onValueChange,
              orientation
            } as any)
          : child
      )}
    </div>
  )
);
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tabsTriggerVariants> {
  value: string;
  asChild?: boolean;
  currentValue?: string;
  onValueChange?: (value: string) => void;
}

const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, variant, value, currentValue, onValueChange, children, ...props }, ref) => {
    const isActive = currentValue === value;

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={isActive}
        aria-controls={`panel-${value}`}
        data-state={isActive ? 'active' : 'inactive'}
        id={`tab-${value}`}
        tabIndex={isActive ? 0 : -1}
        className={cn(tabsTriggerVariants({ variant }), className)}
        onClick={() => onValueChange?.(value)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  currentValue?: string;
}

const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, currentValue, ...props }, ref) => {
    const isActive = currentValue === value;

    if (!isActive) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        aria-labelledby={`tab-${value}`}
        id={`panel-${value}`}
        tabIndex={0}
        className={cn(
          'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className
        )}
        {...props}
      />
    );
  }
);
TabsContent.displayName = 'TabsContent';

// Breadcrumbs Components
const breadcrumbVariants = cva(
  'flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5',
  {
    variants: {
      variant: {
        default: '',
        ghost: 'bg-transparent',
        outline: 'border border-border rounded-md p-2'
      },
      size: {
        sm: 'text-xs gap-1',
        md: 'text-sm gap-1.5',
        lg: 'text-base gap-2'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
);

export interface BreadcrumbProps
  extends React.ComponentProps<'nav'>,
    VariantProps<typeof breadcrumbVariants> {}

const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(
  ({ className, variant, size, ...props }, ref) => (
    <nav
      ref={ref}
      aria-label="breadcrumb"
      className={cn(breadcrumbVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Breadcrumb.displayName = 'Breadcrumb';

export interface BreadcrumbListProps extends React.ComponentProps<'ol'> {}

const BreadcrumbList = forwardRef<HTMLOListElement, BreadcrumbListProps>(
  ({ className, ...props }, ref) => (
    <ol
      ref={ref}
      className={cn('flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5', className)}
      {...props}
    />
  )
);
BreadcrumbList.displayName = 'BreadcrumbList';

export interface BreadcrumbItemProps extends React.ComponentProps<'li'> {}

const BreadcrumbItem = forwardRef<HTMLLIElement, BreadcrumbItemProps>(
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      className={cn('inline-flex items-center gap-1.5', className)}
      {...props}
    />
  )
);
BreadcrumbItem.displayName = 'BreadcrumbItem';

export interface BreadcrumbLinkProps extends React.ComponentProps<'a'> {
  asChild?: boolean;
}

const BreadcrumbLink = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  ({ className, asChild, ...props }, ref) => (
    <a
      ref={ref}
      className={cn('transition-colors hover:text-foreground focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded', className)}
      {...props}
    />
  )
);
BreadcrumbLink.displayName = 'BreadcrumbLink';

export interface BreadcrumbPageProps extends React.ComponentProps<'span'> {}

const BreadcrumbPage = forwardRef<HTMLSpanElement, BreadcrumbPageProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-normal text-foreground', className)}
      {...props}
    />
  )
);
BreadcrumbPage.displayName = 'BreadcrumbPage';

export interface BreadcrumbSeparatorProps extends React.ComponentProps<'span'> {
  children?: React.ReactNode;
}

const BreadcrumbSeparator = forwardRef<HTMLSpanElement, BreadcrumbSeparatorProps>(
  ({ children, className, ...props }, ref) => (
    <span
      ref={ref}
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:size-3.5', className)}
      {...props}
    >
      {children ?? (
        <svg
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </span>
  )
);
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

export interface BreadcrumbEllipsisProps extends React.ComponentProps<'span'> {}

const BreadcrumbEllipsis = forwardRef<HTMLSpanElement, BreadcrumbEllipsisProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      role="presentation"
      aria-hidden="true"
      className={cn('flex h-9 w-9 items-center justify-center', className)}
      {...props}
    >
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
      <span className="sr-only">More</span>
    </span>
  )
);
BreadcrumbEllipsis.displayName = 'BreadcrumbEllipsis';

// Sidebar Components
const sidebarVariants = cva(
  'flex flex-col bg-background border-r border-border',
  {
    variants: {
      variant: {
        default: 'bg-background',
        ghost: 'bg-transparent border-transparent',
        outline: 'border-2'
      },
      size: {
        sm: 'w-48',
        md: 'w-64',
        lg: 'w-80',
        xl: 'w-96'
      },
      position: {
        left: 'border-r',
        right: 'border-l'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      position: 'left'
    }
  }
);

export interface SidebarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof sidebarVariants> {
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(
  ({ 
    className, 
    variant, 
    size, 
    position, 
    collapsible = false,
    collapsed = false,
    onCollapsedChange,
    children,
    ...props 
  }, ref) => {
    const [isCollapsed, setIsCollapsed] = useState(collapsed);

    useEffect(() => {
      setIsCollapsed(collapsed);
    }, [collapsed]);

    const handleToggleCollapse = () => {
      const newCollapsed = !isCollapsed;
      setIsCollapsed(newCollapsed);
      onCollapsedChange?.(newCollapsed);
    };

    return (
      <div
        ref={ref}
        className={cn(
          sidebarVariants({ variant, size: isCollapsed ? 'sm' : size, position }),
          isCollapsed && 'w-16',
          'transition-all duration-200 ease-in-out',
          className
        )}
        data-collapsed={isCollapsed}
        {...props}
      >
        {collapsible && (
          <div className="flex items-center justify-between p-4 border-b border-border">
            {!isCollapsed && (
              <h2 className="text-lg font-semibold">Navigation</h2>
            )}
            <button
              onClick={handleToggleCollapse}
              className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                className={cn('h-4 w-4 transition-transform', isCollapsed && 'rotate-180')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    );
  }
);
Sidebar.displayName = 'Sidebar';

// Sidebar Navigation
export interface SidebarNavProps extends React.HTMLAttributes<HTMLDivElement> {
  collapsed?: boolean;
}

const SidebarNav = forwardRef<HTMLDivElement, SidebarNavProps>(
  ({ className, collapsed = false, ...props }, ref) => (
    <nav
      ref={ref}
      className={cn('p-4 space-y-2', className)}
      {...props}
    />
  )
);
SidebarNav.displayName = 'SidebarNav';

// Sidebar Item
export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  active?: boolean;
  collapsed?: boolean;
  badge?: string | number;
}

const SidebarItem = forwardRef<HTMLButtonElement, SidebarItemProps>(
  ({ 
    className, 
    icon, 
    active = false, 
    collapsed = false, 
    badge, 
    children, 
    ...props 
  }, ref) => (
    <button
      ref={ref}
      className={cn(
        'w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active && 'bg-accent text-accent-foreground',
        collapsed && 'justify-center px-2',
        className
      )}
      {...props}
    >
      {icon && (
        <span className="flex-shrink-0">
          {icon}
        </span>
      )}
      
      {!collapsed && children && (
        <span className="flex-1 text-left">{children}</span>
      )}
      
      {!collapsed && badge && (
        <span className="flex-shrink-0 bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 min-w-[1.25rem] text-center">
          {badge}
        </span>
      )}
    </button>
  )
);
SidebarItem.displayName = 'SidebarItem';

// Sidebar Group
export interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  collapsed?: boolean;
}

const SidebarGroup = forwardRef<HTMLDivElement, SidebarGroupProps>(
  ({ className, title, collapsed = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('space-y-2', className)}
      {...props}
    >
      {title && !collapsed && (
        <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
      )}
      <div className="space-y-1">
        {children}
      </div>
    </div>
  )
);
SidebarGroup.displayName = 'SidebarGroup';

// Pagination Component
export interface PaginationProps extends React.HTMLAttributes<HTMLNavElement> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  showPrevNext?: boolean;
  maxVisible?: number;
}

const Pagination = forwardRef<HTMLElement, PaginationProps>(
  ({ 
    className, 
    currentPage, 
    totalPages, 
    onPageChange, 
    showFirstLast = true,
    showPrevNext = true,
    maxVisible = 5,
    ...props 
  }, ref) => {
    const getVisiblePages = () => {
      const pages = [];
      const start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      const end = Math.min(totalPages, start + maxVisible - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      return pages;
    };

    const visiblePages = getVisiblePages();

    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label={ariaLabel}
        className={cn('flex items-center gap-1', className)}
        {...props}
      >
        {/* First page button */}
        {showFirstLast && currentPage > 1 && (
          <button
            onClick={() => onPageChange(1)}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            aria-label="Go to first page"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Previous button */}
        {showPrevNext && (
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            aria-label="Go to previous page"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Page numbers */}
        {visiblePages.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2',
              page === currentPage
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
            )}
            aria-label={`Go to page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        ))}

        {/* Next button */}
        {showPrevNext && (
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            aria-label="Go to next page"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Last page button */}
        {showFirstLast && currentPage < totalPages && (
          <button
            onClick={() => onPageChange(totalPages)}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            aria-label="Go to last page"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </nav>
    );
  }
);
Pagination.displayName = 'Pagination';

// Export all components
export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  Sidebar,
  SidebarNav,
  SidebarItem,
  SidebarGroup,
  Pagination
};

export type {
  TabsProps,
  TabsListProps,
  TabsTriggerProps,
  TabsContentProps,
  BreadcrumbProps,
  BreadcrumbListProps,
  BreadcrumbItemProps,
  BreadcrumbLinkProps,
  BreadcrumbPageProps,
  BreadcrumbSeparatorProps,
  BreadcrumbEllipsisProps,
  SidebarProps,
  SidebarNavProps,
  SidebarItemProps,
  SidebarGroupProps,
  PaginationProps
};