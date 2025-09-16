/**
 * usePagination Hook
 *
 * A comprehensive pagination management hook with:
 * - Page navigation and boundary handling
 * - Dynamic page size management
 * - Jump to page functionality
 * - URL synchronization for bookmarkable pagination
 * - Pagination state persistence
 * - Performance optimizations
 * - Accessibility support
 * - Analytics and usage tracking
 *
 * @author Frontend Developer
 * @version 1.0.0
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

// =====================
// Types & Interfaces
// =====================

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
}

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  totalItems?: number;
  maxPageSize?: number;
  enableUrlSync?: boolean;
  enablePersistence?: boolean;
  persistenceKey?: string;
  enableAnalytics?: boolean;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export interface UsePaginationReturn {
  // Current state
  pagination: PaginationState;

  // Computed values
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startIndex: number;
  endIndex: number;
  visibleRange: {
    start: number;
    end: number;
  };

  // Navigation methods
  goToPage: (page: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;

  // Configuration methods
  setPageSize: (pageSize: number) => void;
  setTotalItems: (totalItems: number) => void;
  updatePagination: (updates: Partial<PaginationState>) => void;
  resetPagination: () => void;

  // Utility methods
  getPageNumbers: (maxVisible?: number) => (number | 'ellipsis')[];
  getItemsForPage: <T>(items: T[]) => T[];
  jumpToItem: (itemIndex: number) => void;

  // URL and persistence
  getPaginationUrl: () => string;
  setPaginationFromUrl: (url: string) => void;

  // Analytics
  getPaginationAnalytics: () => PaginationAnalytics;
}

export interface PaginationAnalytics {
  totalPageChanges: number;
  averagePageSize: number;
  mostUsedPageSizes: { size: number; count: number }[];
  navigationPatterns: {
    next: number;
    previous: number;
    jump: number;
    first: number;
    last: number;
  };
  timeSpent: number;
}

// =====================
// Constants
// =====================

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_MAX_PAGE_SIZE = 1000;
const COMMON_PAGE_SIZES = [10, 25, 50, 100];
const PERSISTENCE_PREFIX = 'pagination-';

// =====================
// Helper Functions
// =====================

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const generatePageNumbers = (
  currentPage: number,
  totalPages: number,
  maxVisible: number = 7
): (number | 'ellipsis')[] => {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [];
  const sidePages = Math.floor((maxVisible - 3) / 2);

  // Always show first page
  pages.push(1);

  let start = Math.max(2, currentPage - sidePages);
  let end = Math.min(totalPages - 1, currentPage + sidePages);

  // Adjust if we're near the beginning or end
  if (currentPage <= sidePages + 2) {
    end = Math.min(totalPages - 1, maxVisible - 1);
  }
  if (currentPage >= totalPages - sidePages - 1) {
    start = Math.max(2, totalPages - maxVisible + 2);
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

const paginationToUrlParams = (pagination: PaginationState): URLSearchParams => {
  const params = new URLSearchParams();

  if (pagination.currentPage > 1) {
    params.set('page', pagination.currentPage.toString());
  }

  if (pagination.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set('pageSize', pagination.pageSize.toString());
  }

  return params;
};

const urlParamsToPagination = (params: URLSearchParams): Partial<PaginationState> => {
  const pagination: Partial<PaginationState> = {};

  const page = params.get('page');
  if (page) {
    pagination.currentPage = Math.max(1, parseInt(page, 10) || 1);
  }

  const pageSize = params.get('pageSize');
  if (pageSize) {
    const size = parseInt(pageSize, 10);
    if (size > 0 && size <= DEFAULT_MAX_PAGE_SIZE) {
      pagination.pageSize = size;
    }
  }

  return pagination;
};

// =====================
// Storage Functions
// =====================

const loadPaginationState = (key: string): Partial<PaginationState> | null => {
  try {
    const stored = localStorage.getItem(PERSISTENCE_PREFIX + key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load pagination state:', error);
  }
  return null;
};

const savePaginationState = (key: string, pagination: PaginationState): void => {
  try {
    localStorage.setItem(PERSISTENCE_PREFIX + key, JSON.stringify({
      pageSize: pagination.pageSize, // Only persist pageSize, not currentPage
    }));
  } catch (error) {
    console.warn('Failed to save pagination state:', error);
  }
};

const loadPaginationAnalytics = (key: string): PaginationAnalytics => {
  try {
    const stored = localStorage.getItem(`${PERSISTENCE_PREFIX}analytics-${key}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load pagination analytics:', error);
  }
  return {
    totalPageChanges: 0,
    averagePageSize: DEFAULT_PAGE_SIZE,
    mostUsedPageSizes: [],
    navigationPatterns: {
      next: 0,
      previous: 0,
      jump: 0,
      first: 0,
      last: 0,
    },
    timeSpent: 0,
  };
};

const savePaginationAnalytics = (key: string, analytics: PaginationAnalytics): void => {
  try {
    localStorage.setItem(`${PERSISTENCE_PREFIX}analytics-${key}`, JSON.stringify(analytics));
  } catch (error) {
    console.warn('Failed to save pagination analytics:', error);
  }
};

// =====================
// Main Hook
// =====================

export const usePagination = (options: UsePaginationOptions = {}): UsePaginationReturn => {
  const {
    initialPage = 1,
    initialPageSize = DEFAULT_PAGE_SIZE,
    totalItems = 0,
    maxPageSize = DEFAULT_MAX_PAGE_SIZE,
    enableUrlSync = true,
    enablePersistence = true,
    persistenceKey = 'default',
    enableAnalytics = true,
    onPageChange,
    onPageSizeChange,
  } = options;

  // =====================
  // State Management
  // =====================

  const [pagination, setPagination] = useState<PaginationState>(() => {
    let state: PaginationState = {
      currentPage: initialPage,
      pageSize: clamp(initialPageSize, 1, maxPageSize),
      totalItems,
    };

    // Load from persistence
    if (enablePersistence) {
      const persisted = loadPaginationState(persistenceKey);
      if (persisted) {
        state = {
          ...state,
          ...persisted,
          pageSize: clamp(persisted.pageSize || initialPageSize, 1, maxPageSize),
        };
      }
    }

    // Load from URL
    if (enableUrlSync && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const fromUrl = urlParamsToPagination(urlParams);
      if (fromUrl.currentPage || fromUrl.pageSize) {
        state = {
          ...state,
          ...fromUrl,
          pageSize: clamp(fromUrl.pageSize || state.pageSize, 1, maxPageSize),
        };
      }
    }

    return state;
  });

  // Analytics tracking
  const [analytics, setAnalytics] = useState<PaginationAnalytics>(() =>
    enableAnalytics ? loadPaginationAnalytics(persistenceKey) : {
      totalPageChanges: 0,
      averagePageSize: DEFAULT_PAGE_SIZE,
      mostUsedPageSizes: [],
      navigationPatterns: {
        next: 0,
        previous: 0,
        jump: 0,
        first: 0,
        last: 0,
      },
      timeSpent: 0,
    }
  );

  const sessionStartRef = useRef<number>(Date.now());
  const pageSizeHistoryRef = useRef<number[]>([initialPageSize]);

  // =====================
  // Computed Values
  // =====================

  const totalPages = useMemo(() => {
    return pagination.pageSize > 0 ? Math.ceil(pagination.totalItems / pagination.pageSize) : 0;
  }, [pagination.totalItems, pagination.pageSize]);

  const hasNextPage = useMemo(() => {
    return pagination.currentPage < totalPages;
  }, [pagination.currentPage, totalPages]);

  const hasPreviousPage = useMemo(() => {
    return pagination.currentPage > 1;
  }, [pagination.currentPage]);

  const startIndex = useMemo(() => {
    return Math.max(0, (pagination.currentPage - 1) * pagination.pageSize);
  }, [pagination.currentPage, pagination.pageSize]);

  const endIndex = useMemo(() => {
    return Math.min(pagination.totalItems - 1, startIndex + pagination.pageSize - 1);
  }, [pagination.totalItems, startIndex, pagination.pageSize]);

  const visibleRange = useMemo(() => {
    return {
      start: Math.min(startIndex + 1, pagination.totalItems),
      end: Math.min(endIndex + 1, pagination.totalItems),
    };
  }, [startIndex, endIndex, pagination.totalItems]);

  // =====================
  // Helper Functions
  // =====================

  const updateAnalytics = useCallback((action: keyof PaginationAnalytics['navigationPatterns']) => {
    if (!enableAnalytics) return;

    setAnalytics(prev => {
      const updated = {
        ...prev,
        totalPageChanges: prev.totalPageChanges + 1,
        navigationPatterns: {
          ...prev.navigationPatterns,
          [action]: prev.navigationPatterns[action] + 1,
        },
      };

      // Update average page size
      const allPageSizes = pageSizeHistoryRef.current;
      updated.averagePageSize = allPageSizes.reduce((sum, size) => sum + size, 0) / allPageSizes.length;

      // Update most used page sizes
      const pageSizeCounts: Record<number, number> = {};
      allPageSizes.forEach(size => {
        pageSizeCounts[size] = (pageSizeCounts[size] || 0) + 1;
      });

      updated.mostUsedPageSizes = Object.entries(pageSizeCounts)
        .map(([size, count]) => ({ size: parseInt(size), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return updated;
    });
  }, [enableAnalytics]);

  const updatePaginationState = useCallback((
    updates: Partial<PaginationState>,
    analyticsAction?: keyof PaginationAnalytics['navigationPatterns']
  ) => {
    setPagination(prev => {
      const newState = { ...prev, ...updates };

      // Ensure currentPage is within bounds
      if (updates.totalItems !== undefined || updates.pageSize !== undefined) {
        const newTotalPages = Math.ceil(newState.totalItems / newState.pageSize);
        newState.currentPage = Math.max(1, Math.min(newState.currentPage, newTotalPages));
      }

      // Clamp pageSize to allowed range
      if (updates.pageSize !== undefined) {
        newState.pageSize = clamp(updates.pageSize, 1, maxPageSize);
      }

      // Persistence
      if (enablePersistence && (updates.pageSize !== undefined)) {
        savePaginationState(persistenceKey, newState);
      }

      // Analytics
      if (analyticsAction) {
        updateAnalytics(analyticsAction);
      }

      return newState;
    });

    // Callbacks
    if (updates.currentPage !== undefined && onPageChange) {
      onPageChange(updates.currentPage);
    }
    if (updates.pageSize !== undefined && onPageSizeChange) {
      onPageSizeChange(updates.pageSize);
      pageSizeHistoryRef.current.push(updates.pageSize);
    }
  }, [enablePersistence, persistenceKey, maxPageSize, onPageChange, onPageSizeChange, updateAnalytics]);

  // =====================
  // Navigation Methods
  // =====================

  const goToPage = useCallback((page: number) => {
    const targetPage = clamp(page, 1, totalPages);
    if (targetPage !== pagination.currentPage) {
      updatePaginationState({ currentPage: targetPage }, 'jump');
    }
  }, [pagination.currentPage, totalPages, updatePaginationState]);

  const goToFirstPage = useCallback(() => {
    if (pagination.currentPage !== 1) {
      updatePaginationState({ currentPage: 1 }, 'first');
    }
  }, [pagination.currentPage, updatePaginationState]);

  const goToLastPage = useCallback(() => {
    if (pagination.currentPage !== totalPages && totalPages > 0) {
      updatePaginationState({ currentPage: totalPages }, 'last');
    }
  }, [pagination.currentPage, totalPages, updatePaginationState]);

  const goToNextPage = useCallback(() => {
    if (hasNextPage) {
      updatePaginationState({ currentPage: pagination.currentPage + 1 }, 'next');
    }
  }, [hasNextPage, pagination.currentPage, updatePaginationState]);

  const goToPreviousPage = useCallback(() => {
    if (hasPreviousPage) {
      updatePaginationState({ currentPage: pagination.currentPage - 1 }, 'previous');
    }
  }, [hasPreviousPage, pagination.currentPage, updatePaginationState]);

  // =====================
  // Configuration Methods
  // =====================

  const setPageSize = useCallback((pageSize: number) => {
    const newPageSize = clamp(pageSize, 1, maxPageSize);
    if (newPageSize !== pagination.pageSize) {
      // Calculate what the new current page should be to keep the same items visible
      const currentStartIndex = (pagination.currentPage - 1) * pagination.pageSize;
      const newCurrentPage = Math.floor(currentStartIndex / newPageSize) + 1;

      updatePaginationState({
        pageSize: newPageSize,
        currentPage: newCurrentPage,
      });
    }
  }, [pagination.pageSize, pagination.currentPage, maxPageSize, updatePaginationState]);

  const setTotalItems = useCallback((newTotalItems: number) => {
    updatePaginationState({ totalItems: Math.max(0, newTotalItems) });
  }, [updatePaginationState]);

  const updatePagination = useCallback((updates: Partial<PaginationState>) => {
    updatePaginationState(updates);
  }, [updatePaginationState]);

  const resetPagination = useCallback(() => {
    updatePaginationState({
      currentPage: 1,
      pageSize: initialPageSize,
      totalItems: pagination.totalItems, // Keep current totalItems
    });
  }, [initialPageSize, pagination.totalItems, updatePaginationState]);

  // =====================
  // Utility Methods
  // =====================

  const getPageNumbers = useCallback((maxVisible: number = 7): (number | 'ellipsis')[] => {
    return generatePageNumbers(pagination.currentPage, totalPages, maxVisible);
  }, [pagination.currentPage, totalPages]);

  const getItemsForPage = useCallback(<T>(items: T[]): T[] => {
    return items.slice(startIndex, startIndex + pagination.pageSize);
  }, [startIndex, pagination.pageSize]);

  const jumpToItem = useCallback((itemIndex: number) => {
    const targetPage = Math.floor(itemIndex / pagination.pageSize) + 1;
    goToPage(targetPage);
  }, [pagination.pageSize, goToPage]);

  // =====================
  // URL and Persistence
  // =====================

  const getPaginationUrl = useCallback((): string => {
    if (!enableUrlSync) return '';
    const params = paginationToUrlParams(pagination);
    return params.toString();
  }, [pagination, enableUrlSync]);

  const setPaginationFromUrl = useCallback((url: string) => {
    if (!enableUrlSync) return;
    try {
      const params = new URLSearchParams(url);
      const fromUrl = urlParamsToPagination(params);
      updatePagination(fromUrl);
    } catch (error) {
      console.error('Failed to parse pagination from URL:', error);
    }
  }, [enableUrlSync, updatePagination]);

  // =====================
  // Analytics
  // =====================

  const getPaginationAnalytics = useCallback((): PaginationAnalytics => {
    const sessionTime = Date.now() - sessionStartRef.current;
    return {
      ...analytics,
      timeSpent: sessionTime,
    };
  }, [analytics]);

  // =====================
  // Effects
  // =====================

  // Update totalItems when the option changes
  useEffect(() => {
    if (totalItems !== pagination.totalItems) {
      setTotalItems(totalItems);
    }
  }, [totalItems, pagination.totalItems, setTotalItems]);

  // URL synchronization
  useEffect(() => {
    if (enableUrlSync && typeof window !== 'undefined') {
      const params = paginationToUrlParams(pagination);
      const currentParams = new URLSearchParams(window.location.search);

      // Only update URL if pagination params have changed
      if (params.toString() !== currentParams.toString()) {
        // Preserve non-pagination parameters
        const allParams = new URLSearchParams(window.location.search);
        allParams.delete('page');
        allParams.delete('pageSize');

        // Add pagination parameters
        params.forEach((value, key) => {
          allParams.set(key, value);
        });

        const newUrl = `${window.location.pathname}${allParams.toString() ? '?' + allParams.toString() : ''}`;

        if (window.location.pathname + window.location.search !== newUrl) {
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
  }, [pagination, enableUrlSync]);

  // Save analytics on unmount
  useEffect(() => {
    return () => {
      if (enableAnalytics) {
        const currentAnalytics = getPaginationAnalytics();
        savePaginationAnalytics(persistenceKey, currentAnalytics);
      }
    };
  }, [enableAnalytics, getPaginationAnalytics, persistenceKey]);

  // =====================
  // Return
  // =====================

  return {
    // Current state
    pagination,

    // Computed values
    totalPages,
    hasNextPage,
    hasPreviousPage,
    startIndex,
    endIndex,
    visibleRange,

    // Navigation methods
    goToPage,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,

    // Configuration methods
    setPageSize,
    setTotalItems,
    updatePagination,
    resetPagination,

    // Utility methods
    getPageNumbers,
    getItemsForPage,
    jumpToItem,

    // URL and persistence
    getPaginationUrl,
    setPaginationFromUrl,

    // Analytics
    getPaginationAnalytics,
  };
};

export default usePagination;