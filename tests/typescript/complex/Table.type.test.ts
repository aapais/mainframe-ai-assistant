/**
 * TypeScript Type Tests for Table and DataTable Components
 * Tests generic types, data validation, column constraints, and complex data structures
 */

import { describe, it, expectTypeOf } from 'vitest';
import type { ComponentProps, ReactNode, RefObject, HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  DataTable,
  Badge,
  Avatar,
  List,
  ListItem,
  Progress,
  type TableProps,
  type DataTableProps,
  type DataTableColumn,
  type BadgeProps,
  type AvatarProps,
  type ListProps,
  type ListItemProps,
  type ProgressProps
} from '../../../src/renderer/components/ui/DataDisplay';

describe('Table Component TypeScript Tests', () => {
  describe('Basic Table Component Types', () => {
    it('should extend HTMLTableElement attributes', () => {
      expectTypeOf<TableProps>().toMatchTypeOf<HTMLAttributes<HTMLTableElement>>();
    });

    it('should properly forward ref for Table', () => {
      type TableRef = Parameters<typeof Table>[1];
      expectTypeOf<TableRef>().toEqualTypeOf<
        RefObject<HTMLTableElement> | ((instance: HTMLTableElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for TableHeader', () => {
      type TableHeaderRef = Parameters<typeof TableHeader>[1];
      expectTypeOf<TableHeaderRef>().toEqualTypeOf<
        RefObject<HTMLTableSectionElement> | ((instance: HTMLTableSectionElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for TableHead', () => {
      type TableHeadRef = Parameters<typeof TableHead>[1];
      expectTypeOf<TableHeadRef>().toEqualTypeOf<
        RefObject<HTMLTableCellElement> | ((instance: HTMLTableCellElement | null) => void) | null | undefined
      >();
    });

    it('should properly forward ref for TableCell', () => {
      type TableCellRef = Parameters<typeof TableCell>[1];
      expectTypeOf<TableCellRef>().toEqualTypeOf<
        RefObject<HTMLTableCellElement> | ((instance: HTMLTableCellElement | null) => void) | null | undefined
      >();
    });
  });

  describe('Table Sub-component Types', () => {
    it('should extend proper HTML attributes for TableHeader', () => {
      type TableHeaderProps = ComponentProps<typeof TableHeader>;
      expectTypeOf<TableHeaderProps>().toMatchTypeOf<HTMLAttributes<HTMLTableSectionElement>>();
    });

    it('should extend proper HTML attributes for TableBody', () => {
      type TableBodyProps = ComponentProps<typeof TableBody>;
      expectTypeOf<TableBodyProps>().toMatchTypeOf<HTMLAttributes<HTMLTableSectionElement>>();
    });

    it('should extend proper HTML attributes for TableFooter', () => {
      type TableFooterProps = ComponentProps<typeof TableFooter>;
      expectTypeOf<TableFooterProps>().toMatchTypeOf<HTMLAttributes<HTMLTableSectionElement>>();
    });

    it('should extend proper HTML attributes for TableRow', () => {
      type TableRowProps = ComponentProps<typeof TableRow>;
      expectTypeOf<TableRowProps>().toMatchTypeOf<HTMLAttributes<HTMLTableRowElement>>();
    });

    it('should extend proper HTML attributes for TableHead', () => {
      type TableHeadProps = ComponentProps<typeof TableHead>;
      expectTypeOf<TableHeadProps>().toMatchTypeOf<ThHTMLAttributes<HTMLTableCellElement>>();
    });

    it('should extend proper HTML attributes for TableCell', () => {
      type TableCellProps = ComponentProps<typeof TableCell>;
      expectTypeOf<TableCellProps>().toMatchTypeOf<TdHTMLAttributes<HTMLTableCellElement>>();
    });

    it('should extend proper HTML attributes for TableCaption', () => {
      type TableCaptionProps = ComponentProps<typeof TableCaption>;
      expectTypeOf<TableCaptionProps>().toMatchTypeOf<HTMLAttributes<HTMLTableCaptionElement>>();
    });
  });

  describe('DataTable Generic Types', () => {
    // Test data types for DataTable
    type TestUser = {
      id: number;
      name: string;
      email: string;
      role: 'admin' | 'user' | 'moderator';
      isActive: boolean;
      createdAt: Date;
    };

    it('should require data array and columns', () => {
      expectTypeOf<DataTableProps<TestUser>['data']>().toEqualTypeOf<TestUser[]>();
      expectTypeOf<DataTableProps<TestUser>['columns']>().toEqualTypeOf<DataTableColumn<TestUser>[]>();
    });

    it('should omit children from TableProps', () => {
      expectTypeOf<DataTableProps<TestUser>>().toMatchTypeOf<Omit<TableProps, 'children'>>();
    });

    it('should accept optional configuration props', () => {
      expectTypeOf<DataTableProps<TestUser>['loading']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<DataTableProps<TestUser>['emptyMessage']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<DataTableProps<TestUser>['pageSize']>().toEqualTypeOf<number | undefined>();
      expectTypeOf<DataTableProps<TestUser>['sortable']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<DataTableProps<TestUser>['filterable']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<DataTableProps<TestUser>['selectable']>().toEqualTypeOf<boolean | undefined>();
    });

    it('should properly type callback functions', () => {
      expectTypeOf<DataTableProps<TestUser>['onRowSelect']>().toEqualTypeOf<
        ((rows: TestUser[]) => void) | undefined
      >();

      expectTypeOf<DataTableProps<TestUser>['onSort']>().toEqualTypeOf<
        ((key: keyof TestUser, direction: 'asc' | 'desc') => void) | undefined
      >();

      expectTypeOf<DataTableProps<TestUser>['onFilter']>().toEqualTypeOf<
        ((key: keyof TestUser, value: string) => void) | undefined
      >();
    });
  });

  describe('DataTableColumn Generic Types', () => {
    type TestProduct = {
      id: string;
      name: string;
      price: number;
      category: string;
      inStock: boolean;
    };

    it('should require key and title', () => {
      expectTypeOf<DataTableColumn<TestProduct>['key']>().toEqualTypeOf<keyof TestProduct>();
      expectTypeOf<DataTableColumn<TestProduct>['title']>().toEqualTypeOf<string>();
    });

    it('should accept optional configuration props', () => {
      expectTypeOf<DataTableColumn<TestProduct>['sortable']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<DataTableColumn<TestProduct>['filterable']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<DataTableColumn<TestProduct>['width']>().toEqualTypeOf<string | undefined>();
    });

    it('should accept alignment options', () => {
      expectTypeOf<DataTableColumn<TestProduct>['align']>().toEqualTypeOf<
        'left' | 'center' | 'right' | undefined
      >();
    });

    it('should properly type render function', () => {
      expectTypeOf<DataTableColumn<TestProduct>['render']>().toEqualTypeOf<
        ((value: TestProduct[keyof TestProduct], row: TestProduct, index: number) => ReactNode) | undefined
      >();
    });
  });

  describe('Complex Generic Type Constraints', () => {
    // Test with complex nested data
    type ComplexData = {
      id: number;
      metadata: {
        tags: string[];
        config: Record<string, any>;
      };
      timestamps: {
        created: Date;
        updated: Date;
      };
      status: 'pending' | 'processing' | 'completed' | 'failed';
    };

    it('should handle complex nested object types', () => {
      type ComplexColumn = DataTableColumn<ComplexData>;

      expectTypeOf<ComplexColumn['key']>().toEqualTypeOf<keyof ComplexData>();

      // Test that render function receives proper types
      expectTypeOf<NonNullable<ComplexColumn['render']>>().toMatchTypeOf<
        (value: ComplexData[keyof ComplexData], row: ComplexData, index: number) => ReactNode
      >();
    });

    it('should constrain column keys to actual object properties', () => {
      type ValidKeys = keyof ComplexData;
      expectTypeOf<ValidKeys>().toEqualTypeOf<'id' | 'metadata' | 'timestamps' | 'status'>();

      type ColumnKey = DataTableColumn<ComplexData>['key'];
      expectTypeOf<ColumnKey>().toEqualTypeOf<ValidKeys>();
    });

    it('should handle union types in data', () => {
      type UnionData = {
        value: string | number | boolean;
        type: 'text' | 'number' | 'boolean';
      };

      expectTypeOf<DataTableColumn<UnionData>['key']>().toEqualTypeOf<'value' | 'type'>();
    });
  });

  describe('DataTable Function Component Type', () => {
    it('should accept generic type parameter', () => {
      type User = { id: number; name: string };

      // DataTable should be callable with User type
      expectTypeOf<typeof DataTable<User>>().toBeCallable();

      // Should return JSX.Element
      expectTypeOf<ReturnType<typeof DataTable<User>>>().toEqualTypeOf<JSX.Element>();
    });

    it('should enforce data and columns relationship', () => {
      type Order = {
        orderId: string;
        customerId: number;
        total: number;
      };

      const validColumns: DataTableColumn<Order>[] = [
        { key: 'orderId', title: 'Order ID' },
        { key: 'customerId', title: 'Customer' },
        { key: 'total', title: 'Total' }
      ];

      expectTypeOf(validColumns).toMatchTypeOf<DataTableColumn<Order>[]>();
    });
  });

  describe('Record Type Constraints', () => {
    it('should extend Record<string, any> for generic constraint', () => {
      // DataTable requires T extends Record<string, any>
      type ValidType = { name: string; age: number };
      type InvalidType = string[]; // This should not work

      expectTypeOf<ValidType>().toMatchTypeOf<Record<string, any>>();
      // InvalidType would fail type checking if used with DataTable
    });

    it('should handle optional properties in data type', () => {
      type PartialData = {
        id: string;
        name: string;
        email?: string;
        phone?: string;
      };

      expectTypeOf<DataTableColumn<PartialData>['key']>().toEqualTypeOf<
        'id' | 'name' | 'email' | 'phone'
      >();
    });
  });
});

describe('Badge Component TypeScript Tests', () => {
  describe('BadgeProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<BadgeProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });

    it('should accept variant types', () => {
      expectTypeOf<BadgeProps['variant']>().toEqualTypeOf<
        'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline' | 'jcl' | 'vsam' | 'db2' | 'batch' | 'functional' | undefined
      >();
    });

    it('should accept size types', () => {
      expectTypeOf<BadgeProps['size']>().toEqualTypeOf<
        'sm' | 'md' | 'lg' | undefined
      >();
    });

    it('should accept removable configuration', () => {
      expectTypeOf<BadgeProps['removable']>().toEqualTypeOf<boolean | undefined>();
      expectTypeOf<BadgeProps['onRemove']>().toEqualTypeOf<(() => void) | undefined>();
    });

    it('should accept icon prop', () => {
      expectTypeOf<BadgeProps['icon']>().toEqualTypeOf<ReactNode | undefined>();
    });
  });
});

describe('Avatar Component TypeScript Tests', () => {
  describe('AvatarProps Interface', () => {
    it('should extend HTMLSpanElement attributes', () => {
      expectTypeOf<AvatarProps>().toMatchTypeOf<HTMLAttributes<HTMLSpanElement>>();
    });

    it('should accept size variants', () => {
      expectTypeOf<AvatarProps['size']>().toEqualTypeOf<
        'sm' | 'md' | 'lg' | 'xl' | undefined
      >();
    });

    it('should accept shape variants', () => {
      expectTypeOf<AvatarProps['shape']>().toEqualTypeOf<
        'circle' | 'square' | undefined
      >();
    });

    it('should accept image props', () => {
      expectTypeOf<AvatarProps['src']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<AvatarProps['alt']>().toEqualTypeOf<string | undefined>();
      expectTypeOf<AvatarProps['fallback']>().toEqualTypeOf<string | undefined>();
    });
  });
});

describe('List Component TypeScript Tests', () => {
  describe('ListProps Interface', () => {
    it('should extend HTMLUListElement attributes', () => {
      expectTypeOf<ListProps>().toMatchTypeOf<HTMLAttributes<HTMLUListElement>>();
    });

    it('should accept variant types', () => {
      expectTypeOf<ListProps['variant']>().toEqualTypeOf<
        'default' | 'ordered' | undefined
      >();
    });

    it('should accept spacing types', () => {
      expectTypeOf<ListProps['spacing']>().toEqualTypeOf<
        'tight' | 'normal' | 'relaxed' | undefined
      >();
    });
  });

  describe('ListItemProps Interface', () => {
    it('should extend HTMLLIElement attributes', () => {
      expectTypeOf<ListItemProps>().toMatchTypeOf<HTMLAttributes<HTMLLIElement>>();
    });
  });
});

describe('Progress Component TypeScript Tests', () => {
  describe('ProgressProps Interface', () => {
    it('should extend HTMLDivElement attributes', () => {
      expectTypeOf<ProgressProps>().toMatchTypeOf<HTMLAttributes<HTMLDivElement>>();
    });

    it('should accept size variants', () => {
      expectTypeOf<ProgressProps['size']>().toEqualTypeOf<
        'sm' | 'md' | 'lg' | undefined
      >();
    });

    it('should accept variant types', () => {
      expectTypeOf<ProgressProps['variant']>().toEqualTypeOf<
        'default' | 'success' | 'warning' | 'danger' | undefined
      >();
    });

    it('should accept value and max props', () => {
      expectTypeOf<ProgressProps['value']>().toEqualTypeOf<number | undefined>();
      expectTypeOf<ProgressProps['max']>().toEqualTypeOf<number | undefined>();
      expectTypeOf<ProgressProps['showLabel']>().toEqualTypeOf<boolean | undefined>();
    });
  });
});

describe('Complex Component Integration Types', () => {
  it('should handle DataTable with Badge cells', () => {
    type UserWithBadges = {
      id: number;
      name: string;
      status: 'active' | 'inactive';
      roles: string[];
    };

    type StatusColumn = DataTableColumn<UserWithBadges> & {
      key: 'status';
      render: (value: 'active' | 'inactive', row: UserWithBadges, index: number) => ReactNode;
    };

    expectTypeOf<StatusColumn>().toMatchTypeOf<DataTableColumn<UserWithBadges>>();
  });

  it('should handle DataTable with Avatar cells', () => {
    type UserProfile = {
      id: string;
      avatar: string;
      name: string;
      email: string;
    };

    type AvatarColumn = DataTableColumn<UserProfile> & {
      key: 'avatar';
      render: (value: string, row: UserProfile, index: number) => ReactNode;
    };

    expectTypeOf<AvatarColumn>().toMatchTypeOf<DataTableColumn<UserProfile>>();
  });

  it('should handle DataTable with Progress cells', () => {
    type TaskProgress = {
      id: number;
      name: string;
      progress: number;
      maxProgress: number;
    };

    type ProgressColumn = DataTableColumn<TaskProgress> & {
      key: 'progress';
      render: (value: number, row: TaskProgress, index: number) => ReactNode;
    };

    expectTypeOf<ProgressColumn>().toMatchTypeOf<DataTableColumn<TaskProgress>>();
  });
});