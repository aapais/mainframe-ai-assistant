/**
 * TypeScript Type Tests for Navigation Components
 * Tests tabs, breadcrumbs, sidebar, and pagination type validation
 */

import { describe, it, expectTypeOf } from 'vitest';
import type { ComponentProps, ReactNode, RefObject, HTMLAttributes, ButtonHTMLAttributes } from 'react';
import {
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
  Pagination,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentProps,
  type BreadcrumbProps,
  type BreadcrumbListProps,
  type BreadcrumbItemProps,
  type BreadcrumbLinkProps,
  type BreadcrumbPageProps,
  type BreadcrumbSeparatorProps,
  type BreadcrumbEllipsisProps,
  type SidebarProps,
  type SidebarNavProps,
  type SidebarItemProps,
  type SidebarGroupProps,
  type PaginationProps
} from '../../../src/renderer/components/ui/Navigation';

describe('Tabs Component TypeScript Tests', () => {
  describe('TabsProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<TabsProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });

    it('should accept controlled and uncontrolled state props', () => {
      expectTypeOf<TabsProps['value']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TabsProps['defaultValue']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TabsProps['onValueChange']>().toEqualTypeOf<((value: string) => void) | undefined>();
    });

    it('should accept orientation prop', () => {
      expectTypeOf<TabsProps['orientation']>().toEqualTypeOf<'horizontal' | 'vertical' | undefined>();
    });
  });

  describe('TabsListProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<TabsListProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });

    it('should accept variant types', () => {
      expectTypeOf<TabsListProps['variant']>().toEqualTypeOf<
        'default' | 'pills' | 'underline' | 'card' | undefined
      >();
    });

    it('should accept size types', () => {
      expectTypeOf<TabsListProps['size']>().toEqualTypeOf<
        'sm' | 'md' | 'lg' | undefined
      >();
    });

    it('should accept state management props', () => {
      expectTypeOf<TabsListProps['value']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TabsListProps['onValueChange']>().toEqualTypeOf<((value: string) => void) | undefined>();
      expectTypeOf<TabsListProps['orientation']>().toEqualTypeOf<'horizontal' | 'vertical' | undefined>();
    });
  });

  describe('TabsTriggerProps Interface', () => {
    it('should extend HTMLButtonElement attributes', () => {
      expectTypeOf<TabsTriggerProps>().toMatchTypeOf<ButtonHTMLAttributes<HTMLButtonElement>>();
    });

    it('should require value prop', () => {
      expectTypeOf<TabsTriggerProps['value']>().toEqualTypeOf<string>();
    });

    it('should accept variant types', () => {
      expectTypeOf<TabsTriggerProps['variant']>().toEqualTypeOf<
        'default' | 'pills' | 'underline' | 'card' | undefined
      >();
    });

    it('should accept optional configuration props', () => {
      expectTypeOf<TabsTriggerProps['asChild']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<TabsTriggerProps['currentValue']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<TabsTriggerProps['onValueChange']>().toEqualTypeOf<((value: string) => void) | undefined>();
    });
  });

  describe('TabsContentProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<TabsContentProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });

    it('should require value prop', () => {
      expectTypeOf<TabsContentProps['value']>().toEqualTypeOf<string>();
    });

    it('should accept currentValue prop', () => {
      expectTypeOf<TabsContentProps['currentValue']>().toEqualTypeOf<string | undefined>();
    });
  });

  describe('Tabs Ref Forwarding Types', () => {
    it('should properly forward ref for Tabs', () => {
      type TabsRef = Parameters<typeof Tabs>[1];
      expectTypeOf<TabsRef>().toEqualTypeOf<
        RefObject<HTMLDivElement> | ((instance: HTMLDivElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for TabsList', () => {
      type TabsListRef = Parameters<typeof TabsList>[1];
      expectTypeOf<TabsListRef>().toEqualTypeOf<
        RefObject<HTMLDivElement> | ((instance: HTMLDivElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for TabsTrigger', () => {
      type TabsTriggerRef = Parameters<typeof TabsTrigger>[1];
      expectTypeOf<TabsTriggerRef>().toEqualTypeOf<
        RefObject<HTMLButtonElement> | ((instance: HTMLButtonElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for TabsContent', () => {
      type TabsContentRef = Parameters<typeof TabsContent>[1];
      expectTypeOf<TabsContentRef>().toEqualTypeOf<
        RefObject<HTMLDivElement> | ((instance: HTMLDivElement | null) => void) | null | undefined
      >();
    });
  });
});

describe('Breadcrumb Component TypeScript Tests', () => {
  describe('BreadcrumbProps Interface', () => {
    it('should extend nav element attributes', () => {
      expectTypeOf<BreadcrumbProps>().toMatchTypeOf<React.ComponentProps<'nav'>>();
    });

    it('should accept variant types', () => {
      expectTypeOf<BreadcrumbProps['variant']>().toEqualTypeOf<
        'default' | 'ghost' | 'outline' | undefined
      >();
    });

    it('should accept size types', () => {
      expectTypeOf<BreadcrumbProps['size']>().toEqualTypeOf<
        'sm' | 'md' | 'lg' | undefined
      >();
    });
  });

  describe('Breadcrumb Sub-component Types', () => {
    it('should properly type BreadcrumbList', () => {
      expectTypeOf<BreadcrumbListProps>().toMatchTypeOf<React.ComponentProps<'ol'>>();
    });

    it('should properly type BreadcrumbItem', () => {
      expectTypeOf<BreadcrumbItemProps>().toMatchTypeOf<React.ComponentProps<'li'>>();
    });

    it('should properly type BreadcrumbLink', () => {
      expectTypeOf<BreadcrumbLinkProps>().toMatchTypeOf<React.ComponentProps<'a'>>();
      expectTypeOf<BreadcrumbLinkProps['asChild']>().toEqualTypeOf<boolean | undefined>();
    });

    it('should properly type BreadcrumbPage', () => {
      expectTypeOf<BreadcrumbPageProps>().toMatchTypeOf<React.ComponentProps<'span'>>();
    });

    it('should properly type BreadcrumbSeparator', () => {
      expectTypeOf<BreadcrumbSeparatorProps>().toMatchTypeOf<React.ComponentProps<'span'>>();
      expectTypeOf<BreadcrumbSeparatorProps['children']>().toEqualTypeOf<ReactNode | undefined>();
    });

    it('should properly type BreadcrumbEllipsis', () => {
      expectTypeOf<BreadcrumbEllipsisProps>().toMatchTypeOf<React.ComponentProps<'span'>>();
    });
  });

  describe('Breadcrumb Ref Forwarding Types', () => {
    it('should properly forward ref for Breadcrumb', () => {
      type BreadcrumbRef = Parameters<typeof Breadcrumb>[1];
      expectTypeOf<BreadcrumbRef>().toEqualTypeOf<
        RefObject<HTMLElement> | ((instance: HTMLElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for BreadcrumbList', () => {
      type BreadcrumbListRef = Parameters<typeof BreadcrumbList>[1];
      expectTypeOf<BreadcrumbListRef>().toEqualTypeOf<
        RefObject<HTMLOListElement> | ((instance: HTMLOListElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for BreadcrumbLink', () => {
      type BreadcrumbLinkRef = Parameters<typeof BreadcrumbLink>[1];
      expectTypeOf<BreadcrumbLinkRef>().toEqualTypeOf<
        RefObject<HTMLAnchorElement> | ((instance: HTMLAnchorElement | null) => void) | null | undefined
      >();
    });
  });
});

describe('Sidebar Component TypeScript Tests', () => {
  describe('SidebarProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<SidebarProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });

    it('should accept variant types', () => {
      expectTypeOf<SidebarProps['variant']>().toEqualTypeOf<
        'default' | 'ghost' | 'outline' | undefined
      >();
    });

    it('should accept size types', () => {
      expectTypeOf<SidebarProps['size']>().toEqualTypeOf<
        'sm' | 'md' | 'lg' | 'xl' | undefined
      >();
    });

    it('should accept position types', () => {
      expectTypeOf<SidebarProps['position']>().toEqualTypeOf<
        'left' | 'right' | undefined
      >();
    });

    it('should accept collapsible configuration', () => {
      expectTypeOf<SidebarProps['collapsible']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<SidebarProps['collapsed']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<SidebarProps['onCollapsedChange']>().toEqualTypeOf<((collapsed: boolean) => void) | undefined>();
    });
  });

  describe('SidebarNavProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<SidebarNavProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });

    it('should accept collapsed prop', () => {
      expectTypeOf<SidebarNavProps['collapsed']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('SidebarItemProps Interface', () => {
    it('should extend HTMLButtonElement attributes', () => {
      expectTypeOf<SidebarItemProps>().toMatchTypeOf<ButtonHTMLAttributes<HTMLButtonElement>>();
    });

    it('should accept optional configuration props', () => {
      expectTypeOf<SidebarItemProps['icon']>().toEqualTypeOf<ReactNode | undefined>();
      expectTypeOf<SidebarItemProps['active']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<SidebarItemProps['collapsed']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<SidebarItemProps['badge']>().toEqualTypeOf<string | number | undefined>();
    });
  });

  describe('SidebarGroupProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<SidebarGroupProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });

    it('should accept title and collapsed props', () => {
      expectTypeOf<SidebarGroupProps['title']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<SidebarGroupProps['collapsed']>().toEqualTypeOf<boolean | undefined>();
    });
  });

  describe('Sidebar Ref Forwarding Types', () => {
    it('should properly forward ref for Sidebar', () => {
      type SidebarRef = Parameters<typeof Sidebar>[1];
      expectTypeOf<SidebarRef>().toEqualTypeOf<
        RefObject<HTMLDivElement> | ((instance: HTMLDivElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for SidebarItem', () => {
      type SidebarItemRef = Parameters<typeof SidebarItem>[1];
      expectTypeOf<SidebarItemRef>().toEqualTypeOf<
        RefObject<HTMLButtonElement> | ((instance: HTMLButtonElement | null) => void) | null | undefined
      >();
    });
  });
});

describe('Pagination Component TypeScript Tests', () => {
  describe('PaginationProps Interface', () => {
    it('should extend HTMLNavElement attributes', () => {
      expectTypeOf<PaginationProps>().toMatchTypeOf<HTMLAttributes<HTMLNavElement>>();
    });

    it('should require pagination state props', () => {
      expectTypeOf<PaginationProps['currentPage']>().toEqualTypeOf<number>();
      expectTypeOf<PaginationProps['totalPages']>().toEqualTypeOf<number>();
      expectTypeOf<PaginationProps['onPageChange']>().toEqualTypeOf<(page: number) => void>();
    });

    it('should accept optional configuration props', () => {
      expectTypeOf<PaginationProps['showFirstLast']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<PaginationProps['showPrevNext']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<PaginationProps['maxVisible']>().toEqualTypeOf<number | undefined>();
    });
  });

  describe('Pagination Event Handler Types', () => {
    it('should properly type onPageChange callback', () => {
      type OnPageChangeHandler = PaginationProps['onPageChange'];

      expectTypeOf<OnPageChangeHandler>().toMatchTypeOf<(page: number) => void>();
    });
  });

  describe('Pagination Ref Forwarding Types', () => {
    it('should properly forward ref for Pagination', () => {
      type PaginationRef = Parameters<typeof Pagination>[1];
      expectTypeOf<PaginationRef>().toEqualTypeOf<
        RefObject<HTMLElement> | ((instance: HTMLElement | null) => void) | null | undefined
      >();
    });
  });
});

describe('Navigation Component Variant Constraints', () => {
  describe('Tabs Variant Types', () => {
    it('should constrain TabsList variant types', () => {
      type TabsListVariants = NonNullable<TabsListProps['variant']>;
      expectTypeOf<TabsListVariants>().toEqualTypeOf<'default' | 'pills' | 'underline' | 'card'>();
    });

    it('should constrain TabsList size types', () => {
      type TabsListSizes = NonNullable<TabsListProps['size']>;
      expectTypeOf<TabsListSizes>().toEqualTypeOf<'sm' | 'md' | 'lg'>();
    });

    it('should constrain TabsTrigger variant types', () => {
      type TabsTriggerVariants = NonNullable<TabsTriggerProps['variant']>;
      expectTypeOf<TabsTriggerVariants>().toEqualTypeOf<'default' | 'pills' | 'underline' | 'card'>();
    });
  });

  describe('Breadcrumb Variant Types', () => {
    it('should constrain Breadcrumb variant types', () => {
      type BreadcrumbVariants = NonNullable<BreadcrumbProps['variant']>;
      expectTypeOf<BreadcrumbVariants>().toEqualTypeOf<'default' | 'ghost' | 'outline'>();
    });

    it('should constrain Breadcrumb size types', () => {
      type BreadcrumbSizes = NonNullable<BreadcrumbProps['size']>;
      expectTypeOf<BreadcrumbSizes>().toEqualTypeOf<'sm' | 'md' | 'lg'>();
    });
  });

  describe('Sidebar Variant Types', () => {
    it('should constrain Sidebar variant types', () => {
      type SidebarVariants = NonNullable<SidebarProps['variant']>;
      expectTypeOf<SidebarVariants>().toEqualTypeOf<'default' | 'ghost' | 'outline'>();
    });

    it('should constrain Sidebar size types', () => {
      type SidebarSizes = NonNullable<SidebarProps['size']>;
      expectTypeOf<SidebarSizes>().toEqualTypeOf<'sm' | 'md' | 'lg' | 'xl'>();
    });

    it('should constrain Sidebar position types', () => {
      type SidebarPositions = NonNullable<SidebarProps['position']>;
      expectTypeOf<SidebarPositions>().toEqualTypeOf<'left' | 'right'>();
    });
  });
});

describe('Complex Navigation Component Integration', () => {
  describe('Controlled vs Uncontrolled Tabs', () => {
    it('should handle controlled tabs configuration', () => {
      type ControlledTabs = {
        value: string;
        onValueChange: (value: string) => void;
      };

      expectTypeOf<ControlledTabs>().toMatchTypeOf<Partial<TabsProps>>();
    });

    it('should handle uncontrolled tabs configuration', () => {
      type UncontrolledTabs = {
        defaultValue: string;
      };

      expectTypeOf<UncontrolledTabs>().toMatchTypeOf<Partial<TabsProps>>();
    });
  });

  describe('Sidebar State Management', () => {
    it('should handle collapsible sidebar configuration', () => {
      type CollapsibleSidebar = {
        collapsible: true;
        collapsed: boolean;
        onCollapsedChange: (collapsed: boolean) => void;
      };

      expectTypeOf<CollapsibleSidebar>().toMatchTypeOf<Partial<SidebarProps>>();
    });

    it('should handle fixed sidebar configuration', () => {
      type FixedSidebar = {
        collapsible: false;
      };

      expectTypeOf<FixedSidebar>().toMatchTypeOf<Partial<SidebarProps>>();
    });
  });

  describe('Pagination State Management', () => {
    it('should handle complete pagination configuration', () => {
      type CompletePagination = {
        currentPage: number;
        totalPages: number;
        onPageChange: (page: number) => void;
        showFirstLast: boolean;
        showPrevNext: boolean;
        maxVisible: number;
      };

      expectTypeOf<CompletePagination>().toMatchTypeOf<PaginationProps>();
    });
  });

  describe('Badge Type Compatibility', () => {
    it('should handle sidebar item badge types', () => {
      type BadgeTypes = NonNullable<SidebarItemProps['badge']>;
      expectTypeOf<BadgeTypes>().toEqualTypeOf<string | number>();
    });
  });
});

describe('Navigation Component Type Inference', () => {
  it('should infer correct types for tabs configuration', () => {
    const tabsConfig = {
      value: 'tab1',
      onValueChange: (value: string) => {},
      orientation: 'horizontal' as const
    };

    expectTypeOf(tabsConfig).toMatchTypeOf<{
      value: string;
      onValueChange: (value: string) => void;
      orientation: 'horizontal';
    }>();
  });

  it('should infer correct types for sidebar configuration', () => {
    const sidebarConfig = {
      variant: 'default' as const,
      size: 'md' as const,
      position: 'left' as const,
      collapsible: true,
      collapsed: false
    };

    expectTypeOf(sidebarConfig).toMatchTypeOf<Partial<SidebarProps>>();
  });

  it('should infer correct types for pagination configuration', () => {
    const paginationConfig = {
      currentPage: 1,
      totalPages: 10,
      onPageChange: (page: number) => {},
      maxVisible: 5
    };

    expectTypeOf(paginationConfig).toMatchTypeOf<Partial<PaginationProps>>();
  });
});