/**
 * Accessible KB Table Component
 * Comprehensive table with full screen reader support for Knowledge Base entries
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { KBEntry, KBCategory } from '../../types/services';
import { ScreenReaderOnly, ScreenReaderStatus } from './ScreenReaderOnly';
import { useScreenReaderAnnouncements } from '../hooks/useScreenReaderAnnouncements';
import { ScreenReaderTextUtils } from '../utils/screenReaderUtils';

export interface AccessibleKBTableProps {
  /**
   * KB entries to display
   */
  entries: KBEntry[];

  /**
   * Selected entry ID
   */
  selectedEntryId?: string;

  /**
   * Callback when entry is selected
   */
  onEntrySelect?: (entry: KBEntry) => void;

  /**
   * Callback when entry is rated
   */
  onEntryRate?: (entryId: string, successful: boolean) => void;

  /**
   * Columns to display
   */
  columns?: Array<{
    key: keyof KBEntry | 'actions';
    label: string;
    sortable?: boolean;
    width?: string;
    render?: (entry: KBEntry) => React.ReactNode;
  }>;

  /**
   * Whether to show usage statistics
   */
  showUsageStats?: boolean;

  /**
   * Whether to allow sorting
   */
  sortable?: boolean;

  /**
   * Current sort configuration
   */
  sortConfig?: {
    key: keyof KBEntry;
    direction: 'asc' | 'desc';
  };

  /**
   * Callback when sort changes
   */
  onSortChange?: (key: keyof KBEntry, direction: 'asc' | 'desc') => void;

  /**
   * Whether to announce table updates
   */
  announceUpdates?: boolean;

  /**
   * Maximum height for scrollable table
   */
  maxHeight?: string;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Table caption for screen readers
   */
  caption?: string;

  /**
   * Loading state
   */
  loading?: boolean;

  /**
   * Empty state message
   */
  emptyMessage?: string;
}

export interface TableColumn {
  key: keyof KBEntry | 'actions';
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (entry: KBEntry) => React.ReactNode;
}

// Default columns configuration
const defaultColumns: TableColumn[] = [
  {
    key: 'title',
    label: 'Title',
    sortable: true,
    width: '30%'
  },
  {
    key: 'category',
    label: 'Category',
    sortable: true,
    width: '15%'
  },
  {
    key: 'problem',
    label: 'Problem',
    width: '35%',
    render: (entry) => (
      <div className="truncate" title={entry.problem}>
        {entry.problem.length > 100
          ? `${entry.problem.substring(0, 100)}...`
          : entry.problem
        }
      </div>
    )
  },
  {
    key: 'usage_count',
    label: 'Usage',
    sortable: true,
    width: '10%'
  },
  {
    key: 'actions',
    label: 'Actions',
    width: '10%'
  }
];

/**
 * Accessible Table Header Component
 */
const AccessibleTableHeader: React.FC<{
  columns: TableColumn[];
  sortConfig?: { key: keyof KBEntry; direction: 'asc' | 'desc' };
  onSort?: (key: keyof KBEntry) => void;
  showUsageStats: boolean;
}> = ({ columns, sortConfig, onSort, showUsageStats }) => {

  const getSortAriaLabel = (column: TableColumn) => {
    if (!column.sortable || column.key === 'actions') return column.label;

    const currentSort = sortConfig?.key === column.key;
    const direction = sortConfig?.direction;

    if (currentSort) {
      return `${column.label}, currently sorted ${direction === 'asc' ? 'ascending' : 'descending'}. Click to sort ${direction === 'asc' ? 'descending' : 'ascending'}`;
    }

    return `${column.label}, not sorted. Click to sort ascending`;
  };

  const getSortIcon = (column: TableColumn) => {
    if (!column.sortable || column.key === 'actions') return null;

    const currentSort = sortConfig?.key === column.key;

    if (currentSort) {
      return sortConfig?.direction === 'asc' ? '↑' : '↓';
    }

    return '↕';
  };

  return (
    <thead>
      <tr>
        {columns.map((column) => {
          const isSortable = column.sortable && column.key !== 'actions';

          if (column.key === 'usage_count' && !showUsageStats) {
            return null;
          }

          return (
            <th
              key={column.key}
              scope="col"
              style={{
                width: column.width,
                padding: '0.75rem',
                textAlign: 'left',
                backgroundColor: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                fontWeight: 'medium',
                fontSize: '0.875rem',
                color: '#374151'
              }}
              {...(isSortable && {
                tabIndex: 0,
                role: 'button',
                'aria-label': getSortAriaLabel(column),
                onClick: () => onSort?.(column.key as keyof KBEntry),
                onKeyDown: (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSort?.(column.key as keyof KBEntry);
                  }
                },
                style: {
                  ...column.width && { width: column.width },
                  padding: '0.75rem',
                  textAlign: 'left',
                  backgroundColor: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  fontWeight: 'medium',
                  fontSize: '0.875rem',
                  color: '#374151',
                  cursor: 'pointer',
                  userSelect: 'none'
                }
              })}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {column.label}
                {isSortable && (
                  <span aria-hidden="true" style={{ opacity: 0.5 }}>
                    {getSortIcon(column)}
                  </span>
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
};

/**
 * Accessible Table Row Component
 */
const AccessibleTableRow: React.FC<{
  entry: KBEntry;
  columns: TableColumn[];
  isSelected: boolean;
  onSelect?: (entry: KBEntry) => void;
  onRate?: (entryId: string, successful: boolean) => void;
  showUsageStats: boolean;
  index: number;
}> = ({ entry, columns, isSelected, onSelect, onRate, showUsageStats, index }) => {
  const [isRating, setIsRating] = useState(false);
  const rowRef = useRef<HTMLTableRowElement>(null);

  const handleRowClick = useCallback(() => {
    onSelect?.(entry);
  }, [entry, onSelect]);

  const handleRowKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleRowClick();
        break;
    }
  }, [handleRowClick]);

  const handleRate = useCallback(async (successful: boolean) => {
    setIsRating(true);
    try {
      await onRate?.(entry.id, successful);
    } finally {
      setIsRating(false);
    }
  }, [entry.id, onRate]);

  const renderCellContent = useCallback((column: TableColumn) => {
    if (column.render) {
      return column.render(entry);
    }

    switch (column.key) {
      case 'actions':
        return (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRate(true);
              }}
              disabled={isRating}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
              aria-label={`Mark entry "${entry.title}" as helpful`}
              title="Mark as helpful"
            >
              👍
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRate(false);
              }}
              disabled={isRating}
              style={{
                padding: '0.25rem 0.5rem',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
              aria-label={`Mark entry "${entry.title}" as not helpful`}
              title="Mark as not helpful"
            >
              👎
            </button>
          </div>
        );

      case 'usage_count':
        if (!showUsageStats) return null;
        return entry.usage_count || 0;

      case 'category':
        return (
          <span
            style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 'medium'
            }}
          >
            {entry.category}
          </span>
        );

      default:
        const value = entry[column.key as keyof KBEntry];
        return typeof value === 'string' ? value : String(value || '');
    }
  }, [entry, handleRate, isRating, showUsageStats]);

  const getRowDescription = useCallback(() => {
    const parts = [
      `Row ${index + 1}`,
      `Title: ${entry.title}`,
      `Category: ${entry.category}`,
      showUsageStats && entry.usage_count && `Used ${entry.usage_count} times`
    ].filter(Boolean);

    return parts.join(', ');
  }, [entry, index, showUsageStats]);

  return (
    <tr
      ref={rowRef}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      tabIndex={0}
      role="button"
      aria-selected={isSelected}
      aria-label={`Select entry: ${entry.title}`}
      aria-describedby={`row-desc-${entry.id}`}
      style={{
        backgroundColor: isSelected ? '#eff6ff' : 'white',
        cursor: 'pointer',
        borderBottom: '1px solid #e5e7eb'
      }}
      className={`table-row ${isSelected ? 'selected' : ''}`}
    >
      <ScreenReaderOnly id={`row-desc-${entry.id}`}>
        {getRowDescription()}
      </ScreenReaderOnly>

      {columns.map((column) => {
        if (column.key === 'usage_count' && !showUsageStats) {
          return null;
        }

        return (
          <td
            key={column.key}
            style={{
              padding: '0.75rem',
              verticalAlign: 'top',
              fontSize: '0.875rem'
            }}
            {...(column.key === 'title' && { 'data-label': 'Title' })}
          >
            {renderCellContent(column)}
          </td>
        );
      })}
    </tr>
  );
};

/**
 * Main Accessible KB Table Component
 */
export const AccessibleKBTable: React.FC<AccessibleKBTableProps> = ({
  entries,
  selectedEntryId,
  onEntrySelect,
  onEntryRate,
  columns = defaultColumns,
  showUsageStats = true,
  sortable = true,
  sortConfig,
  onSortChange,
  announceUpdates = true,
  maxHeight = '600px',
  className = '',
  caption = 'Knowledge Base Entries',
  loading = false,
  emptyMessage = 'No entries found'
}) => {
  const { announceTableUpdate, announceSelectionChange } = useScreenReaderAnnouncements();
  const tableRef = useRef<HTMLTableElement>(null);
  const [lastUpdateAnnounced, setLastUpdateAnnounced] = useState(0);

  // Announce table updates
  useEffect(() => {
    if (announceUpdates && entries.length > 0 && entries.length !== lastUpdateAnnounced) {
      const updateDescription = sortConfig
        ? `sorted by ${sortConfig.key} ${sortConfig.direction}ending`
        : 'updated';

      announceTableUpdate(entries.length, updateDescription);
      setLastUpdateAnnounced(entries.length);
    }
  }, [entries.length, announceUpdates, announceTableUpdate, lastUpdateAnnounced, sortConfig]);

  // Handle sort changes
  const handleSort = useCallback((key: keyof KBEntry) => {
    if (!sortable || !onSortChange) return;

    const currentDirection = sortConfig?.key === key ? sortConfig.direction : null;
    const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

    onSortChange(key, newDirection);
  }, [sortable, sortConfig, onSortChange]);

  // Handle entry selection
  const handleEntrySelect = useCallback((entry: KBEntry) => {
    onEntrySelect?.(entry);

    if (announceUpdates) {
      announceSelectionChange(`${entry.title} in ${entry.category} category`);
    }
  }, [onEntrySelect, announceUpdates, announceSelectionChange]);

  // Filter columns based on showUsageStats
  const visibleColumns = useMemo(() => {
    return columns.filter(column => {
      if (column.key === 'usage_count' && !showUsageStats) {
        return false;
      }
      return true;
    });
  }, [columns, showUsageStats]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          color: '#6b7280'
        }}
      >
        <ScreenReaderStatus>Loading knowledge base entries...</ScreenReaderStatus>
        <div>Loading entries...</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          color: '#6b7280'
        }}
        role="status"
        aria-live="polite"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`accessible-kb-table ${className}`}>
      {/* Table summary for screen readers */}
      <ScreenReaderOnly>
        <p>
          {ScreenReaderTextUtils.createNavigationDescription(
            'Knowledge Base Table',
            undefined,
            undefined
          )}
          {entries.length} entries displayed.
          {sortConfig && ` Currently sorted by ${sortConfig.key} in ${sortConfig.direction}ending order.`}
          Use arrow keys to navigate, Enter to select entries.
        </p>
      </ScreenReaderOnly>

      <div
        style={{
          maxHeight,
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: '8px'
        }}
      >
        <table
          ref={tableRef}
          style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}
          role="table"
          aria-label={caption}
          aria-rowcount={entries.length + 1} // +1 for header
          aria-colcount={visibleColumns.length}
        >
          {/* Table caption */}
          <caption style={{
            padding: '0.5rem',
            fontSize: '0.875rem',
            color: '#6b7280',
            textAlign: 'left',
            borderBottom: '1px solid #e5e7eb'
          }}>
            {caption} ({entries.length} entries)
            {sortConfig && (
              <span> - Sorted by {sortConfig.key} {sortConfig.direction}ending</span>
            )}
          </caption>

          {/* Table header */}
          <AccessibleTableHeader
            columns={visibleColumns}
            sortConfig={sortConfig}
            onSort={handleSort}
            showUsageStats={showUsageStats}
          />

          {/* Table body */}
          <tbody>
            {entries.map((entry, index) => (
              <AccessibleTableRow
                key={entry.id}
                entry={entry}
                columns={visibleColumns}
                isSelected={selectedEntryId === entry.id}
                onSelect={handleEntrySelect}
                onRate={onEntryRate}
                showUsageStats={showUsageStats}
                index={index}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Keyboard shortcuts help */}
      <ScreenReaderOnly>
        <details style={{ marginTop: '1rem' }}>
          <summary>Table keyboard shortcuts</summary>
          <ul>
            <li>Tab/Shift+Tab: Move between table elements</li>
            <li>Arrow keys: Navigate table cells</li>
            <li>Enter/Space: Select entry or sort column</li>
            <li>Home/End: Jump to first/last row</li>
          </ul>
        </details>
      </ScreenReaderOnly>

      {/* Selection status */}
      {selectedEntryId && (
        <ScreenReaderStatus>
          {(() => {
            const selectedEntry = entries.find(e => e.id === selectedEntryId);
            return selectedEntry ? `Selected entry: ${selectedEntry.title}` : '';
          })()}
        </ScreenReaderStatus>
      )}
    </div>
  );
};

export default AccessibleKBTable;