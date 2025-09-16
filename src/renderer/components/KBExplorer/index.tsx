/**
 * KB Explorer - Advanced Knowledge Base Management Interface
 *
 * A comprehensive KB listing interface with advanced filtering, sorting,
 * pagination, export capabilities, and saved searches management.
 *
 * Features:
 * - Advanced multi-filter panel (category, date, success rate, usage)
 * - Sortable table with multi-column support
 * - Configurable pagination with different page sizes
 * - Export functionality (CSV, JSON, PDF)
 * - Saved searches management
 * - Responsive design with Tailwind CSS
 * - Real-time search with debouncing
 * - Accessibility support (ARIA, keyboard navigation)
 *
 * @author Frontend Developer
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { KBEntry, KBCategory } from '../../../types/services';
import { FilterPanel } from './FilterPanel';
import { SortableTable } from './SortableTable';
import { PaginationControls } from './PaginationControls';
import { SavedSearchesDropdown } from './SavedSearchesDropdown';
import { ExportDialog } from './ExportDialog';
import { useKBListing } from '../../hooks/useKBListing';
import { useFilters } from '../../hooks/useFilters';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';

// =====================
// Types & Interfaces
// =====================

export interface KBExplorerProps {
  className?: string;
  onEntrySelect?: (entry: KBEntry) => void;
  onEntryEdit?: (entry: KBEntry) => void;
  onEntryDelete?: (entryId: string) => void;
  enableBulkOperations?: boolean;
  enableExport?: boolean;
  enableSavedSearches?: boolean;
  defaultView?: 'table' | 'cards';
  maxHeight?: string;
}

export interface FilterState {
  categories: KBCategory[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  successRateRange: {
    min: number;
    max: number;
  };
  usageRange: {
    min: number;
    max: number;
  };
  tags: string[];
  searchQuery: string;
}

export interface SortConfig {
  column: keyof KBEntry;
  direction: 'asc' | 'desc';
  priority?: number; // For multi-column sorting
}

export interface SavedSearch {
  id: string;
  name: string;
  filters: FilterState;
  sortConfig: SortConfig[];
  createdAt: Date;
  lastUsed?: Date;
}

// =====================
// Main Component
// =====================

export const KBExplorer: React.FC<KBExplorerProps> = ({
  className = '',
  onEntrySelect,
  onEntryEdit,
  onEntryDelete,
  enableBulkOperations = true,
  enableExport = true,
  enableSavedSearches = true,
  defaultView = 'table',
  maxHeight = '80vh',
}) => {
  // =====================
  // State Management
  // =====================

  const [view, setView] = useState<'table' | 'cards'>(defaultView);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isFiltersVisible, setIsFiltersVisible] = useState(true);

  // Custom hooks
  const { filters, updateFilters, clearFilters, filtersState } = useFilters();
  const { pagination, updatePagination, resetPagination } = usePagination();
  const debouncedSearchQuery = useDebounce(filters.searchQuery, 300);

  const {
    entries,
    totalEntries,
    isLoading,
    error,
    refresh,
    sortConfig,
    updateSort,
    exportData,
  } = useKBListing({
    filters: {
      ...filters,
      searchQuery: debouncedSearchQuery,
    },
    pagination,
    sortConfig: [],
  });

  // =====================
  // Computed Values
  // =====================

  const hasActiveFilters = useMemo(() => {
    return (
      filters.categories.length > 0 ||
      filters.tags.length > 0 ||
      filters.dateRange.start ||
      filters.dateRange.end ||
      filters.successRateRange.min > 0 ||
      filters.successRateRange.max < 100 ||
      filters.usageRange.min > 0 ||
      filters.usageRange.max < 1000 ||
      filters.searchQuery.trim().length > 0
    );
  }, [filters]);

  const selectedCount = selectedEntries.size;
  const isAllSelected = selectedEntries.size === entries.length && entries.length > 0;
  const isPartialSelection = selectedEntries.size > 0 && selectedEntries.size < entries.length;

  // =====================
  // Event Handlers
  // =====================

  const handleFilterUpdate = useCallback((newFilters: Partial<FilterState>) => {
    updateFilters(newFilters);
    resetPagination(); // Reset to first page when filters change
  }, [updateFilters, resetPagination]);

  const handleSortUpdate = useCallback((column: keyof KBEntry, direction: 'asc' | 'desc', addToSort: boolean = false) => {
    updateSort(column, direction, addToSort);
    resetPagination(); // Reset to first page when sorting changes
  }, [updateSort, resetPagination]);

  const handlePaginationUpdate = useCallback((pageUpdate: Partial<typeof pagination>) => {
    updatePagination(pageUpdate);
  }, [updatePagination]);

  const handleEntrySelect = useCallback((entryId: string, selected: boolean) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(entryId);
      } else {
        newSet.delete(entryId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(entries.map(entry => entry.id)));
    }
  }, [isAllSelected, entries]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedEntries.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedEntries.size} selected entries? This action cannot be undone.`
    );

    if (confirmed && onEntryDelete) {
      try {
        // Delete entries one by one (could be optimized with bulk API)
        for (const entryId of selectedEntries) {
          await onEntryDelete(entryId);
        }
        setSelectedEntries(new Set());
        refresh();
      } catch (error) {
        console.error('Failed to delete entries:', error);
        // Show error notification
      }
    }
  }, [selectedEntries, onEntryDelete, refresh]);

  const handleExport = useCallback(async (format: 'csv' | 'json' | 'pdf', options: any) => {
    try {
      const dataToExport = selectedEntries.size > 0
        ? entries.filter(entry => selectedEntries.has(entry.id))
        : entries;

      await exportData(dataToExport, format, options);
      setShowExportDialog(false);
    } catch (error) {
      console.error('Export failed:', error);
      // Show error notification
    }
  }, [entries, selectedEntries, exportData]);

  const handleClearFilters = useCallback(() => {
    clearFilters();
    resetPagination();
  }, [clearFilters, resetPagination]);

  // =====================
  // Effects
  // =====================

  // Clear selection when entries change
  useEffect(() => {
    setSelectedEntries(new Set());
  }, [entries]);

  // =====================
  // Render
  // =====================

  return (
    <div className={`kb-explorer flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
          {/* Title and Stats */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 truncate">
              Knowledge Base Explorer
            </h1>
            <div className="mt-1 flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4 text-sm text-gray-500">
              <span className="flex-shrink-0">
                {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}
              </span>
              {hasActiveFilters && (
                <span className="text-blue-600 flex-shrink-0">
                  • {entries.length} filtered
                </span>
              )}
              {selectedCount > 0 && (
                <span className="text-green-600 flex-shrink-0">
                  • {selectedCount} selected
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
            {/* Mobile Actions Row 1 */}
            <div className="flex items-center justify-between sm:justify-start space-x-2 sm:space-x-3">
              {/* View Toggle - Hidden on mobile */}
              <div className="hidden sm:flex rounded-lg border border-gray-300 p-1">
                <button
                  onClick={() => setView('table')}
                  className={`px-2 py-1 text-sm font-medium rounded-md transition-colors ${
                    view === 'table'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-pressed={view === 'table'}
                  title="Table view"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18m-9 8h9" />
                  </svg>
                  <span className="sr-only">Table view</span>
                </button>
                <button
                  onClick={() => setView('cards')}
                  className={`px-2 py-1 text-sm font-medium rounded-md transition-colors ${
                    view === 'cards'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  aria-pressed={view === 'cards'}
                  title="Card view"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="sr-only">Card view</span>
                </button>
              </div>

              {/* Filters Toggle */}
              <button
                onClick={() => setIsFiltersVisible(!isFiltersVisible)}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  isFiltersVisible
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
                aria-pressed={isFiltersVisible}
              >
                <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                </svg>
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && (
                  <span className="ml-1 sm:ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {Object.values(filters).filter(Boolean).length}
                  </span>
                )}
              </button>

              {/* Refresh - Always visible */}
              <button
                onClick={refresh}
                disabled={isLoading}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                <svg
                  className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="sr-only">Refresh</span>
              </button>
            </div>

            {/* Mobile Actions Row 2 / Desktop Actions */}
            <div className="flex items-center justify-between sm:justify-start space-x-2 sm:space-x-3">
              {/* Saved Searches */}
              {enableSavedSearches && (
                <div className="flex-shrink-0">
                  <SavedSearchesDropdown
                    currentFilters={filters}
                    currentSort={sortConfig}
                    onLoadSearch={(savedSearch) => {
                      updateFilters(savedSearch.filters);
                      // Update sort config
                      resetPagination();
                    }}
                  />
                </div>
              )}

              {/* Export */}
              {enableExport && (
                <button
                  onClick={() => setShowExportDialog(true)}
                  className="flex items-center px-3 py-2 sm:px-4 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                  title={`Export ${selectedCount > 0 ? `${selectedCount} selected entries` : 'all entries'}`}
                >
                  <svg className="w-4 h-4 sm:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Export</span>
                  {selectedCount > 0 && (
                    <span className="ml-1 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                      {selectedCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {enableBulkOperations && selectedCount > 0 && (
          <div className="mt-4 flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center">
              <span className="text-sm font-medium text-blue-800">
                {selectedCount} {selectedCount === 1 ? 'entry' : 'entries'} selected
              </span>
            </div>
            <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
              <button
                onClick={() => setSelectedEntries(new Set())}
                className="text-sm text-blue-600 hover:text-blue-800 text-left sm:text-center"
              >
                Clear selection
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 self-start sm:self-center"
              >
                Delete selected
              </button>
            </div>
          </div>
        )}

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-4 flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2 flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-700 flex-shrink-0">Active filters:</span>
              <div className="flex items-center space-x-2 flex-wrap">
                {filters.categories.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Categories: {filters.categories.join(', ')}
                  </span>
                )}
                {filters.tags.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Tags: {filters.tags.join(', ')}
                  </span>
                )}
                {filters.searchQuery && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 max-w-xs truncate">
                    Search: "{filters.searchQuery}"
                  </span>
                )}
                {(filters.dateRange.start || filters.dateRange.end) && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Date range active
                  </span>
                )}
                {(filters.successRateRange.min > 0 || filters.successRateRange.max < 100) && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    Success rate: {filters.successRateRange.min}%-{filters.successRateRange.max}%
                  </span>
                )}
                {(filters.usageRange.min > 0 || filters.usageRange.max < 1000) && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                    Usage: {filters.usageRange.min}-{filters.usageRange.max > 999 ? '1000+' : filters.usageRange.max}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 flex-shrink-0 underline sm:no-underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Filter Panel */}
        {isFiltersVisible && (
          <div className={`
            flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50
            ${isFiltersVisible ? 'lg:w-80' : 'w-0'}
            transition-all duration-300 ease-in-out
            ${isFiltersVisible ? 'max-h-96 lg:max-h-none' : 'max-h-0 lg:max-h-none'}
            overflow-hidden lg:overflow-visible
          `}>
            <FilterPanel
              filters={filters}
              onFiltersChange={handleFilterUpdate}
              availableTags={[]} // This would come from the KB data
              className="h-full"
            />
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Error State */}
          {error && (
            <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg sm:mx-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error loading entries
                  </h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && entries.length === 0 && (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-sm text-gray-500">Loading entries...</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && entries.length === 0 && !error && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  {hasActiveFilters ? 'No entries match your filters' : 'No entries found'}
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  {hasActiveFilters
                    ? 'Try adjusting your filter criteria to see more results.'
                    : 'Get started by adding some knowledge base entries.'
                  }
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="mt-4 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Table/Cards Content */}
          {!isLoading && entries.length > 0 && (
            <>
              <div className="flex-1 overflow-hidden px-4 sm:px-6">
                {view === 'table' ? (
                  <div className="overflow-x-auto">
                    <SortableTable
                      entries={entries}
                      selectedEntries={selectedEntries}
                      onEntrySelect={handleEntrySelect}
                      onSelectAll={handleSelectAll}
                      onEntryClick={onEntrySelect}
                      onEntryEdit={onEntryEdit}
                      onEntryDelete={onEntryDelete}
                      sortConfig={sortConfig}
                      onSort={handleSortUpdate}
                      enableBulkSelect={enableBulkOperations}
                      isAllSelected={isAllSelected}
                      isPartialSelection={isPartialSelection}
                      className="h-full min-w-full"
                    />
                  </div>
                ) : (
                  <div className="py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-auto" style={{ maxHeight }}>
                    {entries.map(entry => (
                      <div
                        key={entry.id}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => onEntrySelect?.(entry)}
                      >
                        {/* Card content */}
                        <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{entry.title}</h3>
                        <p className="text-xs text-gray-600 mb-3 line-clamp-3">{entry.problem}</p>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {entry.category}
                          </span>
                          <div className="text-xs text-gray-500">
                            {entry.usage_count || 0} uses
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-4 sm:px-6">
                <PaginationControls
                  currentPage={pagination.currentPage}
                  totalPages={Math.ceil(totalEntries / pagination.pageSize)}
                  pageSize={pagination.pageSize}
                  totalItems={totalEntries}
                  onPageChange={(page) => handlePaginationUpdate({ currentPage: page })}
                  onPageSizeChange={(pageSize) => handlePaginationUpdate({ pageSize, currentPage: 1 })}
                  pageSizeOptions={[10, 25, 50, 100]}
                  showPageSizeSelector={true}
                  showItemsInfo={true}
                  isLoading={isLoading}
                  className="responsive-pagination"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Export Dialog */}
      {showExportDialog && (
        <ExportDialog
          entries={selectedEntries.size > 0
            ? entries.filter(entry => selectedEntries.has(entry.id))
            : entries
          }
          onExport={handleExport}
          onClose={() => setShowExportDialog(false)}
          defaultFormat="csv"
        />
      )}
    </div>
  );
};

export default KBExplorer;