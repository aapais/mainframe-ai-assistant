import React, { forwardRef, useState, useMemo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/className';

// Badge Component
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        success: 'border-transparent bg-success text-success-foreground hover:bg-success/80',
        warning: 'border-transparent bg-warning text-warning-foreground hover:bg-warning/80',
        outline: 'text-foreground border-border hover:bg-accent hover:text-accent-foreground',
        // Mainframe category colors
        'jcl': 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
        'vsam': 'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
        'db2': 'border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
        'batch': 'border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
        'functional': 'border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100'
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'md'
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  removable?: boolean;
  onRemove?: () => void;
  icon?: React.ReactNode;
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, removable = false, onRemove, icon, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {icon && <span className="mr-1">{icon}</span>}
        {children}
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-1 hover:bg-black/20 rounded-full p-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Remove badge"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

// Avatar Component
const avatarVariants = cva(
  'inline-flex items-center justify-center font-normal text-foreground select-none shrink-0 bg-muted overflow-hidden',
  {
    variants: {
      size: {
        sm: 'h-6 w-6 text-xs',
        md: 'h-8 w-8 text-sm',
        lg: 'h-12 w-12 text-base',
        xl: 'h-16 w-16 text-lg'
      },
      shape: {
        circle: 'rounded-full',
        square: 'rounded-md'
      }
    },
    defaultVariants: {
      size: 'md',
      shape: 'circle'
    }
  }
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  fallback?: string;
}

const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, size, shape, src, alt, fallback, children, ...props }, ref) => {
    const [imageLoadError, setImageLoadError] = useState(false);

    return (
      <span
        ref={ref}
        className={cn(avatarVariants({ size, shape }), className)}
        {...props}
      >
        {src && !imageLoadError ? (
          <img
            src={src}
            alt={alt}
            onError={() => setImageLoadError(true)}
            className="aspect-square h-full w-full object-cover"
          />
        ) : fallback ? (
          <span className="text-center font-medium uppercase">{fallback}</span>
        ) : (
          children
        )}
      </span>
    );
  }
);

Avatar.displayName = 'Avatar';

// Table Components
export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}

const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
);
Table.displayName = 'Table';

const TableHeader = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

// Data Table with sorting, filtering, pagination
export interface DataTableColumn<T> {
  key: keyof T;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: T[keyof T], row: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T> extends Omit<TableProps, 'children'> {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  emptyMessage?: string;
  pageSize?: number;
  sortable?: boolean;
  filterable?: boolean;
  selectable?: boolean;
  onRowSelect?: (rows: T[]) => void;
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  onFilter?: (key: keyof T, value: string) => void;
}

function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  pageSize = 10,
  sortable = true,
  filterable = true,
  selectable = false,
  onRowSelect,
  onSort,
  onFilter,
  className,
  ...props
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<T[]>([]);

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(item => 
          String(item[key]).toLowerCase().includes(value.toLowerCase())
        );
      }
    });

    // Apply sorting
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, filters, sortKey, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = processedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleSort = (key: keyof T) => {
    if (!sortable) return;
    
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDirection(newDirection);
    onSort?.(key, newDirection);
  };

  const handleFilter = (key: keyof T, value: string) => {
    setFilters(prev => ({ ...prev, [key as string]: value }));
    setCurrentPage(1);
    onFilter?.(key, value);
  };

  const handleRowSelect = (row: T, checked: boolean) => {
    const newSelection = checked
      ? [...selectedRows, row]
      : selectedRows.filter(selected => selected !== row);
    
    setSelectedRows(newSelection);
    onRowSelect?.(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelection = checked ? [...paginatedData] : [];
    setSelectedRows(newSelection);
    onRowSelect?.(newSelection);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {filterable && (
        <div className="flex flex-wrap gap-2">
          {columns.filter(col => col.filterable).map(column => (
            <div key={String(column.key)} className="min-w-0 flex-1 max-w-xs">
              <input
                type="text"
                placeholder={`Filter by ${column.title}`}
                className="w-full px-3 py-2 border border-input rounded-md text-sm"
                onChange={(e) => handleFilter(column.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <Table className={className} {...props}>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedRows.length === paginatedData.length && paginatedData.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-input"
                />
              </TableHead>
            )}
            {columns.map(column => (
              <TableHead
                key={String(column.key)}
                className={cn(
                  column.sortable && sortable && 'cursor-pointer hover:bg-muted/50',
                  column.align === 'center' && 'text-center',
                  column.align === 'right' && 'text-right'
                )}
                style={{ width: column.width }}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="flex items-center gap-1">
                  {column.title}
                  {column.sortable && sortable && (
                    <div className="flex flex-col">
                      <svg
                        className={cn(
                          'h-3 w-3',
                          sortKey === column.key && sortDirection === 'asc'
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        )}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <svg
                        className={cn(
                          'h-3 w-3 -mt-1',
                          sortKey === column.key && sortDirection === 'desc'
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        )}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.length === 0 ? (
            <TableRow>
              <TableCell 
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="text-center text-muted-foreground py-8"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            paginatedData.map((row, index) => (
              <TableRow key={index}>
                {selectable && (
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(row)}
                      onChange={(e) => handleRowSelect(row, e.target.checked)}
                      className="rounded border-input"
                    />
                  </TableCell>
                )}
                {columns.map(column => (
                  <TableCell
                    key={String(column.key)}
                    className={cn(
                      column.align === 'center' && 'text-center',
                      column.align === 'right' && 'text-right'
                    )}
                  >
                    {column.render
                      ? column.render(row[column.key], row, index)
                      : String(row[column.key] || '')
                    }
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, processedData.length)} of {processedData.length} entries
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'px-3 py-1 text-sm border rounded hover:bg-muted',
                    currentPage === page && 'bg-primary text-primary-foreground'
                  )}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// List Components
export interface ListProps extends React.HTMLAttributes<HTMLUListElement> {
  variant?: 'default' | 'ordered';
  spacing?: 'tight' | 'normal' | 'relaxed';
}

const List = forwardRef<HTMLUListElement, ListProps>(
  ({ className, variant = 'default', spacing = 'normal', children, ...props }, ref) => {
    const Component = variant === 'ordered' ? 'ol' : 'ul';
    
    const spacingClasses = {
      tight: 'space-y-1',
      normal: 'space-y-2',
      relaxed: 'space-y-3'
    };

    return (
      <Component
        ref={ref}
        className={cn(
          'list-inside',
          variant === 'default' && 'list-disc',
          variant === 'ordered' && 'list-decimal',
          spacingClasses[spacing],
          className
        )}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

List.displayName = 'List';

export interface ListItemProps extends React.HTMLAttributes<HTMLLIElement> {}

const ListItem = forwardRef<HTMLLIElement, ListItemProps>(
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      className={cn('text-sm leading-6', className)}
      {...props}
    />
  )
);

ListItem.displayName = 'ListItem';

// Progress Bar Component
const progressVariants = cva(
  'h-2 w-full overflow-hidden rounded-full bg-secondary',
  {
    variants: {
      size: {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3'
      }
    },
    defaultVariants: {
      size: 'md'
    }
  }
);

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants> {
  value?: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  ({ 
    className, 
    size, 
    value = 0, 
    max = 100, 
    variant = 'default',
    showLabel = false,
    ...props 
  }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    
    const variantClasses = {
      default: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      danger: 'bg-destructive'
    };

    return (
      <div className="w-full">
        {showLabel && (
          <div className="flex justify-between text-sm mb-1">
            <span>Progress</span>
            <span>{Math.round(percentage)}%</span>
          </div>
        )}
        <div
          ref={ref}
          className={cn(progressVariants({ size }), className)}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          {...props}
        >
          <div
            className={cn(
              'h-full transition-all duration-300 ease-out rounded-full',
              variantClasses[variant]
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);

Progress.displayName = 'Progress';

// Export all components
export {
  Badge,
  Avatar,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  DataTable,
  List,
  ListItem,
  Progress
};

export type {
  BadgeProps,
  AvatarProps,
  TableProps,
  DataTableProps,
  DataTableColumn,
  ListProps,
  ListItemProps,
  ProgressProps
};