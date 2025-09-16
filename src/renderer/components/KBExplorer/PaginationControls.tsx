/**
 * PaginationControls Component
 *
 * Comprehensive pagination controls with:
 * - Page navigation (first, previous, next, last)
 * - Direct page number input
 * - Configurable page sizes
 * - Items per page information
 * - Responsive design for mobile devices
 * - Accessibility support (ARIA labels, keyboard navigation)
 * - Loading states and disabled states
 * - Jump to page functionality
 *
 * @author Frontend Developer
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

// =====================
// Types & Interfaces
// =====================

export interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showItemsInfo?: boolean;
  showJumpToPage?: boolean;
  maxVisiblePages?: number;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

interface PageButtonProps {
  page: number;
  currentPage: number;
  onClick: (page: number) => void;
  disabled?: boolean;
  isEllipsis?: boolean;
}

// =====================
// Helper Functions
// =====================

const generatePageNumbers = (
  currentPage: number,
  totalPages: number,
  maxVisiblePages: number = 7
): (number | 'ellipsis')[] => {
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];
  const sidePages = Math.floor((maxVisiblePages - 3) / 2); // Reserve space for first, last, and ellipsis

  // Always show first page
  pages.push(1);

  // Calculate start and end of middle section
  let start = Math.max(2, currentPage - sidePages);
  let end = Math.min(totalPages - 1, currentPage + sidePages);

  // Adjust if we're near the beginning or end
  if (currentPage <= sidePages + 2) {
    end = Math.min(totalPages - 1, maxVisiblePages - 1);
  }
  if (currentPage >= totalPages - sidePages - 1) {
    start = Math.max(2, totalPages - maxVisiblePages + 2);
  }

  // Add ellipsis after first page if needed
  if (start > 2) {
    pages.push('ellipsis');
  }

  // Add middle pages
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  // Add ellipsis before last page if needed
  if (end < totalPages - 1) {
    pages.push('ellipsis');
  }

  // Always show last page (if more than 1 page)
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
};

// =====================
// Sub-components
// =====================

const PageButton: React.FC<PageButtonProps> = ({
  page,
  currentPage,
  onClick,
  disabled = false,
  isEllipsis = false,
}) => {
  const isActive = page === currentPage;

  if (isEllipsis) {
    return (
      <span className="px-3 py-2 text-sm text-gray-500 select-none">
        ...
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick(page)}
      disabled={disabled}
      className={`
        px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${isActive
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }
        ${disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer'
        }
        border
      `}
      aria-label={`Go to page ${page}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {page}
    </button>
  );
};

const NavigationButton: React.FC<{
  onClick: () => void;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
  direction: 'left' | 'right';
}> = ({ onClick, disabled, label, icon, direction }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`
      px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md
      hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white
      transition-colors duration-150
      flex items-center space-x-1
    `}
    aria-label={label}
  >
    {direction === 'left' && icon}
    <span className="hidden sm:inline">{label}</span>
    {direction === 'right' && icon}
  </button>
);

const JumpToPage: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled: boolean;
}> = ({ currentPage, totalPages, onPageChange, disabled }) => {
  const [inputValue, setInputValue] = useState(currentPage.toString());
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(currentPage.toString());
  }, [currentPage]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(inputValue);
    if (page && page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
    setIsOpen(false);
  }, [inputValue, totalPages, currentPage, onPageChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setInputValue(currentPage.toString());
      setIsOpen(false);
    }
  }, [currentPage]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 focus:outline-none focus:underline disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Jump to specific page"
      >
        Jump to page
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-white border border-gray-300 rounded-md shadow-lg p-3 z-10">
          <form onSubmit={handleSubmit} className="flex items-center space-x-2">
            <label htmlFor="page-input" className="text-sm text-gray-600 whitespace-nowrap">
              Page:
            </label>
            <input
              id="page-input"
              ref={inputRef}
              type="number"
              min={1}
              max={totalPages}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <span className="text-sm text-gray-500">/ {totalPages}</span>
            <button
              type="submit"
              className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800 focus:outline-none focus:underline"
            >
              Go
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

// =====================
// Main Component
// =====================

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelector = true,
  showItemsInfo = true,
  showJumpToPage = true,
  maxVisiblePages = 7,
  isLoading = false,
  disabled = false,
  className = '',
}) => {
  // =====================
  // Computed Values
  // =====================

  const pageNumbers = useMemo(
    () => generatePageNumbers(currentPage, totalPages, maxVisiblePages),
    [currentPage, totalPages, maxVisiblePages]
  );

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const canGoToPrevious = currentPage > 1;
  const canGoToNext = currentPage < totalPages;
  const isDisabled = disabled || isLoading;

  // =====================
  // Event Handlers
  // =====================

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage && !isDisabled) {
      onPageChange(page);
    }
  }, [currentPage, totalPages, onPageChange, isDisabled]);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    if (!isDisabled) {
      onPageSizeChange(newPageSize);
    }
  }, [onPageSizeChange, isDisabled]);

  const handleFirstPage = useCallback(() => handlePageChange(1), [handlePageChange]);
  const handlePreviousPage = useCallback(() => handlePageChange(currentPage - 1), [handlePageChange, currentPage]);
  const handleNextPage = useCallback(() => handlePageChange(currentPage + 1), [handlePageChange, currentPage]);
  const handleLastPage = useCallback(() => handlePageChange(totalPages), [handlePageChange, totalPages]);

  // =====================
  // Keyboard Navigation
  // =====================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if focus is within pagination or no specific element is focused
      const activeElement = document.activeElement;
      const isPaginationFocused = activeElement && (
        activeElement.closest('.pagination-controls') ||
        activeElement === document.body
      );

      if (!isPaginationFocused || isDisabled) return;

      switch (e.key) {
        case 'ArrowLeft':
          if (canGoToPrevious) {
            e.preventDefault();
            handlePreviousPage();
          }
          break;
        case 'ArrowRight':
          if (canGoToNext) {
            e.preventDefault();
            handleNextPage();
          }
          break;
        case 'Home':
          if (currentPage > 1) {
            e.preventDefault();
            handleFirstPage();
          }
          break;
        case 'End':
          if (currentPage < totalPages) {
            e.preventDefault();
            handleLastPage();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages, canGoToPrevious, canGoToNext, handleFirstPage, handlePreviousPage, handleNextPage, handleLastPage, isDisabled]);

  // =====================
  // Render Nothing if No Pages
  // =====================

  if (totalPages <= 1) {
    return showItemsInfo ? (
      <div className={`pagination-controls flex items-center justify-between ${className}`}>
        <div className="text-sm text-gray-700">
          {totalItems === 0 ? (
            'No items'
          ) : totalItems === 1 ? (
            'Showing 1 item'
          ) : (
            `Showing ${totalItems} items`
          )}
        </div>
        <div></div>
      </div>
    ) : null;
  }

  // =====================
  // Main Render
  // =====================

  return (
    <div className={`pagination-controls ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        {/* Items Info and Page Size Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6 space-y-2 sm:space-y-0">
          {showItemsInfo && (
            <div className="text-sm text-gray-700">
              {totalItems === 0 ? (
                'No items'
              ) : (
                <>
                  Showing <span className="font-medium">{startItem}</span> to{' '}
                  <span className="font-medium">{endItem}</span> of{' '}
                  <span className="font-medium">{totalItems}</span> results
                </>
              )}
            </div>
          )}

          {showPageSizeSelector && pageSizeOptions.length > 1 && (
            <div className="flex items-center space-x-2">
              <label htmlFor="page-size" className="text-sm text-gray-700">
                Show:
              </label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                disabled={isDisabled}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pageSizeOptions.map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-700">per page</span>
            </div>
          )}
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between sm:justify-end space-x-1">
          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center space-x-2 mr-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-500">Loading...</span>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center space-x-1">
            {/* First Page */}
            <NavigationButton
              onClick={handleFirstPage}
              disabled={!canGoToPrevious || isDisabled}
              label="First"
              direction="left"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              }
            />

            {/* Previous Page */}
            <NavigationButton
              onClick={handlePreviousPage}
              disabled={!canGoToPrevious || isDisabled}
              label="Previous"
              direction="left"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              }
            />

            {/* Page Numbers */}
            <div className="hidden sm:flex items-center space-x-1 mx-2">
              {pageNumbers.map((page, index) => (
                <PageButton
                  key={typeof page === 'number' ? page : `ellipsis-${index}`}
                  page={typeof page === 'number' ? page : 0}
                  currentPage={currentPage}
                  onClick={handlePageChange}
                  disabled={isDisabled}
                  isEllipsis={page === 'ellipsis'}
                />
              ))}
            </div>

            {/* Mobile Page Info */}
            <div className="sm:hidden px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-md mx-2">
              {currentPage} / {totalPages}
            </div>

            {/* Next Page */}
            <NavigationButton
              onClick={handleNextPage}
              disabled={!canGoToNext || isDisabled}
              label="Next"
              direction="right"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              }
            />

            {/* Last Page */}
            <NavigationButton
              onClick={handleLastPage}
              disabled={!canGoToNext || isDisabled}
              label="Last"
              direction="right"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              }
            />
          </div>

          {/* Jump to Page */}
          {showJumpToPage && totalPages > maxVisiblePages && (
            <JumpToPage
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              disabled={isDisabled}
            />
          )}
        </div>
      </div>

      {/* Keyboard Hints */}
      <div className="mt-2 text-xs text-gray-500 text-center sm:text-right">
        Use arrow keys, Home/End to navigate pages
      </div>
    </div>
  );
};

export default PaginationControls;