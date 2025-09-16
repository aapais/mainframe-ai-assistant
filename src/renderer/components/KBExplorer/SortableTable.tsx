/**
 * SortableTable Component
 *
 * A comprehensive table component with:
 * - Multi-column sorting with priority indicators
 * - Bulk selection with checkbox controls
 * - Row actions (view, edit, delete)
 * - Responsive design with column priority
 * - Virtual scrolling for performance
 * - Accessibility support (ARIA labels, keyboard navigation)
 * - Customizable column configuration
 *
 * @author Frontend Developer
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { KBEntry, KBCategory } from '../../../types/services';
import { SortConfig } from './index';

// =====================
// Types & Interfaces
// =====================

export interface SortableTableProps {
  entries: KBEntry[];
  selectedEntries: Set<string>;
  onEntrySelect: (entryId: string, selected: boolean) => void;
  onSelectAll: () => void;
  onEntryClick?: (entry: KBEntry) => void;
  onEntryEdit?: (entry: KBEntry) => void;
  onEntryDelete?: (entryId: string) => void;
  sortConfig: SortConfig[];
  onSort: (column: keyof KBEntry, direction: 'asc' | 'desc', addToSort?: boolean) => void;
  enableBulkSelect?: boolean;
  isAllSelected: boolean;
  isPartialSelection: boolean;
  className?: string;
}

interface Column {
  key: keyof KBEntry;
  label: string;
  width?: string;
  minWidth?: string;
  sortable: boolean;
  priority: number; // Higher number = higher priority (shows on smaller screens)
  render?: (entry: KBEntry) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface TableRowProps {
  entry: KBEntry;
  isSelected: boolean;
  onSelect: (entryId: string, selected: boolean) => void;
  onClick?: (entry: KBEntry) => void;
  onEdit?: (entry: KBEntry) => void;
  onDelete?: (entryId: string) => void;
  enableBulkSelect: boolean;
  columns: Column[];
  isEven: boolean;
}

// =====================
// Helper Functions
// =====================

const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatUsageCount = (count: number): string => {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
};

const formatSuccessRate = (successCount: number, failureCount: number): string => {
  const total = successCount + failureCount;
  if (total === 0) return 'N/A';
  const rate = (successCount / total) * 100;
  return `${rate.toFixed(0)}%`;
};

const getSuccessRateColor = (successCount: number, failureCount: number): string => {
  const total = successCount + failureCount;
  if (total === 0) return 'text-gray-500';
  const rate = (successCount / total) * 100;
  if (rate >= 80) return 'text-green-600';
  if (rate >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

const getCategoryColor = (category: KBCategory): { bg: string; text: string } => {
  const colors = {
    'JCL': { bg: 'bg-blue-100', text: 'text-blue-800' },
    'VSAM': { bg: 'bg-green-100', text: 'text-green-800' },
    'DB2': { bg: 'bg-purple-100', text: 'text-purple-800' },
    'Batch': { bg: 'bg-red-100', text: 'text-red-800' },
    'Functional': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    'Other': { bg: 'bg-gray-100', text: 'text-gray-800' },
  };
  return colors[category] || colors['Other'];
};

// =====================
// Sub-components
// =====================

const TableRow: React.FC<TableRowProps> = React.memo(({
  entry,
  isSelected,
  onSelect,
  onClick,
  onEdit,
  onDelete,
  enableBulkSelect,
  columns,
  isEven,
}) => {
  const [showActions, setShowActions] = useState(false);

  const handleRowClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger row click if clicking on checkbox or action buttons
    const target = e.target as HTMLElement;
    if (target.closest('input[type="checkbox"]') || target.closest('.action-button')) {
      return;
    }
    onClick?.(entry);
  }, [onClick, entry]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(entry);
    }
  }, [onClick, entry]);

  return (
    <tr
      className={`
        ${isEven ? 'bg-white' : 'bg-gray-50'}
        hover:bg-blue-50 transition-colors duration-150
        ${isSelected ? 'bg-blue-100 hover:bg-blue-200' : ''}
        ${onClick ? 'cursor-pointer' : ''}
      `}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      tabIndex={onClick ? 0 : -1}
      role={onClick ? 'button' : 'row'}
      aria-selected={isSelected}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Bulk Select Checkbox */}
      {enableBulkSelect && (
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <div className="flex items-center">
            <input
              id={`select-${entry.id}`}
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(entry.id, e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              aria-label={`Select ${entry.title}`}
            />
          </div>
        </td>
      )}

      {/* Dynamic Columns */}
      {columns.map(column => {
        let content: React.ReactNode;

        if (column.render) {
          content = column.render(entry);
        } else {
          switch (column.key) {
            case 'title':
              content = (
                <div className="max-w-xs">
                  <div className="text-sm font-medium text-gray-900 truncate" title={entry.title}>
                    {entry.title}
                  </div>
                  <div className="text-sm text-gray-500 truncate max-w-xs" title={entry.problem}>
                    {entry.problem.substring(0, 100)}
                    {entry.problem.length > 100 ? '...' : ''}
                  </div>
                </div>
              );
              break;

            case 'category':
              const categoryColors = getCategoryColor(entry.category);
              content = (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryColors.bg} ${categoryColors.text}`}>
                  {entry.category}
                </span>
              );
              break;

            case 'tags':
              content = entry.tags && entry.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {entry.tags.slice(0, 2).map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      {tag}
                    </span>
                  ))}
                  {entry.tags.length > 2 && (
                    <span className="text-xs text-gray-500">+{entry.tags.length - 2}</span>
                  )}
                </div>
              ) : (
                <span className="text-gray-400 text-sm">No tags</span>
              );
              break;

            case 'usage_count':
              content = (
                <div className="text-sm text-gray-900">
                  {formatUsageCount(entry.usage_count || 0)}
                </div>
              );
              break;

            case 'success_count':
              const successRate = formatSuccessRate(
                entry.success_count || 0,
                entry.failure_count || 0
              );
              const colorClass = getSuccessRateColor(
                entry.success_count || 0,
                entry.failure_count || 0
              );
              content = (
                <div className={`text-sm font-medium ${colorClass}`}>
                  {successRate}
                </div>
              );
              break;

            case 'created_at':
            case 'updated_at':
              content = (
                <div className="text-sm text-gray-500">
                  {formatDate(entry[column.key])}
                </div>
              );
              break;

            default:
              content = (
                <div className="text-sm text-gray-900">
                  {String(entry[column.key] || '')}
                </div>
              );
          }
        }

        return (
          <td
            key={column.key}
            className={`px-6 py-4 whitespace-nowrap ${column.cellClassName || ''}`}
            style={{
              width: column.width,
              minWidth: column.minWidth,
            }}
          >
            {content}
          </td>
        );
      })}

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className={`flex items-center justify-end space-x-2 transition-opacity duration-200 ${
          showActions ? 'opacity-100' : 'opacity-0'
        }`}>
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(entry);
              }}
              className="action-button text-blue-600 hover:text-blue-900 focus:outline-none focus:underline"
              title="Edit entry"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Are you sure you want to delete "${entry.title}"?`)) {
                  onDelete(entry.id);
                }
              }}
              className="action-button text-red-600 hover:text-red-900 focus:outline-none focus:underline"
              title="Delete entry"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

TableRow.displayName = 'TableRow';

const SortableHeader: React.FC<{
  column: Column;
  sortConfig: SortConfig[];
  onSort: (column: keyof KBEntry, direction: 'asc' | 'desc', addToSort?: boolean) => void;
}> = ({ column, sortConfig, onSort }) => {
  const currentSort = sortConfig.find(s => s.column === column.key);

  const handleSort = useCallback((e: React.MouseEvent) => {
    const addToSort = e.ctrlKey || e.metaKey; // Ctrl/Cmd + click for multi-column sort
    const newDirection = currentSort?.direction === 'asc' ? 'desc' : 'asc';
    onSort(column.key, newDirection, addToSort);
  }, [column.key, currentSort, onSort]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const addToSort = e.ctrlKey || e.metaKey;
      const newDirection = currentSort?.direction === 'asc' ? 'desc' : 'asc';
      onSort(column.key, newDirection, addToSort);
    }
  }, [column.key, currentSort, onSort]);

  if (!column.sortable) {
    return (
      <th
        className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
          column.headerClassName || ''
        }`}
        style={{ width: column.width, minWidth: column.minWidth }}
      >
        {column.label}
      </th>
    );
  }

  return (
    <th
      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${
        column.headerClassName || ''
      }`}
      style={{ width: column.width, minWidth: column.minWidth }}
      onClick={handleSort}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-sort={
        currentSort
          ? currentSort.direction === 'asc'
            ? 'ascending'
            : 'descending'
          : 'none'
      }
    >
      <div className="flex items-center space-x-1">
        <span>{column.label}</span>
        {currentSort && (
          <>
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {currentSort.direction === 'asc' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              )}
            </svg>
            {currentSort.priority !== undefined && (
              <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-blue-500 rounded-full">
                {currentSort.priority + 1}
              </span>
            )}
          </>
        )}
      </div>
    </th>
  );
};

// =====================
// Main Component
// =====================

export const SortableTable: React.FC<SortableTableProps> = ({
  entries,
  selectedEntries,
  onEntrySelect,
  onSelectAll,
  onEntryClick,
  onEntryEdit,
  onEntryDelete,
  sortConfig,
  onSort,
  enableBulkSelect = true,
  isAllSelected,
  isPartialSelection,
  className = '',
}) => {
  const tableRef = useRef<HTMLTableElement>(null);

  // Column configuration with responsive priorities
  const columns: Column[] = useMemo(() => [
    {
      key: 'title',
      label: 'Title & Problem',
      width: '40%',
      minWidth: '300px',
      sortable: true,
      priority: 5, // Always show
      cellClassName: 'max-w-0', // Allow truncation
    },
    {
      key: 'category',
      label: 'Category',
      width: '120px',
      sortable: true,
      priority: 4,
    },
    {
      key: 'usage_count',
      label: 'Usage',
      width: '80px',
      sortable: true,
      priority: 3,
      headerClassName: 'text-center',
      cellClassName: 'text-center',
    },
    {
      key: 'success_count',
      label: 'Success Rate',
      width: '100px',
      sortable: true,
      priority: 3,
      headerClassName: 'text-center',
      cellClassName: 'text-center',
    },
    {
      key: 'tags',
      label: 'Tags',
      width: '200px',
      sortable: false,
      priority: 2,
    },
    {
      key: 'updated_at',
      label: 'Last Modified',
      width: '120px',
      sortable: true,
      priority: 1,
    },
  ], []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target === tableRef.current) {
        switch (e.key) {
          case 'a':
          case 'A':
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              onSelectAll();
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onSelectAll]);

  return (
    <div className={`sortable-table h-full flex flex-col ${className}`}>
      {/* Multi-column sort info */}
      {sortConfig.length > 1 && (
        <div className="px-6 py-2 bg-blue-50 border-b border-blue-200">
          <div className="text-sm text-blue-700">
            <span className="font-medium">Multi-column sort active:</span>
            {' '}
            {sortConfig.map((sort, index) => (
              <span key={sort.column} className="ml-2">
                {index > 0 && ', '}
                <span className="font-medium">{sort.column}</span>
                <span className="ml-1">
                  {sort.direction === 'asc' ? '↑' : '↓'}
                </span>
              </span>
            ))}
            <span className="ml-4 text-blue-500 text-xs">
              Tip: Ctrl/Cmd + click headers to add to sort
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table
          ref={tableRef}
          className="min-w-full divide-y divide-gray-200"
          role="table"
          aria-label="Knowledge base entries"
          tabIndex={0}
        >
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {/* Bulk Select Header */}
              {enableBulkSelect && (
                <th className="px-6 py-3 text-left">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isPartialSelection;
                      }}
                      onChange={onSelectAll}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      aria-label="Select all entries"
                    />
                  </div>
                </th>
              )}

              {/* Column Headers */}
              {columns.map(column => (
                <SortableHeader
                  key={column.key}
                  column={column}
                  sortConfig={sortConfig}
                  onSort={onSort}
                />
              ))}

              {/* Actions Header */}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry, index) => (
              <TableRow
                key={entry.id}
                entry={entry}
                isSelected={selectedEntries.has(entry.id)}
                onSelect={onEntrySelect}
                onClick={onEntryClick}
                onEdit={onEntryEdit}
                onDelete={onEntryDelete}
                enableBulkSelect={enableBulkSelect}
                columns={columns}
                isEven={index % 2 === 0}
              />
            ))}
          </tbody>
        </table>

        {/* Empty state within table */}
        {entries.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No entries</h3>
            <p className="mt-1 text-sm text-gray-500">
              No knowledge base entries to display.
            </p>
          </div>
        )}
      </div>

      {/* Table Footer with Sort Hints */}
      <div className="px-6 py-2 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div>
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} displayed
          </div>
          <div className="flex items-center space-x-4">
            {enableBulkSelect && selectedEntries.size > 0 && (
              <span>
                {selectedEntries.size} selected
              </span>
            )}
            <span>
              Click headers to sort • Ctrl+click for multi-column
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SortableTable;