/**
 * useFilters Hook
 *
 * A comprehensive hook for managing complex filter states with:
 * - Multiple filter types (category, date, range, tags, search)
 * - Filter validation and normalization
 * - Filter presets and saved configurations
 * - URL synchronization for bookmarkable filters
 * - Filter change tracking and analytics
 * - Performance optimized updates
 * - Filter combination logic
 *
 * @author Frontend Developer
 * @version 1.0.0
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { KBCategory } from '../../types/services';
import { FilterState } from '../components/KBExplorer';

// =====================
// Types & Interfaces
// =====================

export interface UseFiltersOptions {
  initialFilters?: Partial<FilterState>;
  enableUrlSync?: boolean;
  enableValidation?: boolean;
  enableAnalytics?: boolean;
  debounceDelay?: number;
}

export interface UseFiltersReturn {
  // Current state
  filters: FilterState;
  filtersState: {
    hasActiveFilters: boolean;
    filterCount: number;
    appliedFiltersCount: number;
    isValid: boolean;
  };

  // Actions
  updateFilters: (updates: Partial<FilterState>) => void;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  clearFilters: () => void;
  resetFilter: (key: keyof FilterState) => void;

  // Presets
  saveFilterPreset: (name: string) => void;
  loadFilterPreset: (name: string) => void;
  deleteFilterPreset: (name: string) => void;
  getFilterPresets: () => FilterPreset[];

  // Validation
  validateFilters: (filters: FilterState) => FilterValidationResult;
  getFilterErrors: () => Record<keyof FilterState, string | null>;

  // Analytics
  getFilterAnalytics: () => FilterAnalytics;

  // URL sync
  getFilterUrl: () => string;
  setFiltersFromUrl: (url: string) => void;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: Date;
  usageCount: number;
}

export interface FilterValidationResult {
  isValid: boolean;
  errors: Record<keyof FilterState, string | null>;
  warnings: Record<keyof FilterState, string | null>;
}

export interface FilterAnalytics {
  totalChanges: number;
  mostUsedFilters: { key: keyof FilterState; count: number }[];
  averageFiltersPerSession: number;
  filterCombinations: Record<string, number>;
  timeSpent: number;
}

// =====================
// Constants
// =====================

const DEFAULT_FILTERS: FilterState = {
  categories: [],
  dateRange: {
    start: null,
    end: null,
  },
  successRateRange: {
    min: 0,
    max: 100,
  },
  usageRange: {
    min: 0,
    max: 1000,
  },
  tags: [],
  searchQuery: '',
};

const FILTER_PRESETS_KEY = 'kb-explorer-filter-presets';
const FILTER_ANALYTICS_KEY = 'kb-explorer-filter-analytics';

// =====================
// Helper Functions
// =====================

const validateDateRange = (start: Date | null, end: Date | null): string | null => {
  if (start && end && start > end) {
    return 'Start date must be before end date';
  }
  if (start && start > new Date()) {
    return 'Start date cannot be in the future';
  }
  return null;
};

const validateRange = (range: { min: number; max: number }, absoluteMin: number, absoluteMax: number): string | null => {
  if (range.min > range.max) {
    return 'Minimum value must be less than maximum value';
  }
  if (range.min < absoluteMin || range.max > absoluteMax) {
    return `Range must be between ${absoluteMin} and ${absoluteMax}`;
  }
  return null;
};

const validateCategories = (categories: KBCategory[]): string | null => {
  const validCategories: KBCategory[] = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'];
  const invalidCategories = categories.filter(cat => !validCategories.includes(cat));

  if (invalidCategories.length > 0) {
    return `Invalid categories: ${invalidCategories.join(', ')}`;
  }
  return null;
};

const validateTags = (tags: string[]): string | null => {
  if (tags.length > 20) {
    return 'Maximum 20 tags allowed';
  }

  const invalidTags = tags.filter(tag => tag.length === 0 || tag.length > 50);
  if (invalidTags.length > 0) {
    return 'Tags must be between 1 and 50 characters';
  }

  return null;
};

const validateSearchQuery = (query: string): string | null => {
  if (query.length > 500) {
    return 'Search query too long (maximum 500 characters)';
  }
  return null;
};

const normalizeFilters = (filters: Partial<FilterState>): Partial<FilterState> => {
  const normalized: Partial<FilterState> = { ...filters };

  // Normalize categories (remove duplicates, filter valid ones)
  if (normalized.categories) {
    const validCategories: KBCategory[] = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'];
    normalized.categories = [...new Set(normalized.categories)].filter(cat =>
      validCategories.includes(cat)
    );
  }

  // Normalize tags (remove duplicates, trim whitespace, filter empty)
  if (normalized.tags) {
    normalized.tags = [...new Set(normalized.tags)]
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .slice(0, 20); // Limit to 20 tags
  }

  // Normalize search query (trim whitespace)
  if (normalized.searchQuery !== undefined) {
    normalized.searchQuery = normalized.searchQuery.trim().substring(0, 500);
  }

  // Normalize ranges (ensure min <= max)
  if (normalized.successRateRange) {
    normalized.successRateRange = {
      min: Math.max(0, Math.min(normalized.successRateRange.min, normalized.successRateRange.max)),
      max: Math.min(100, Math.max(normalized.successRateRange.min, normalized.successRateRange.max)),
    };
  }

  if (normalized.usageRange) {
    normalized.usageRange = {
      min: Math.max(0, Math.min(normalized.usageRange.min, normalized.usageRange.max)),
      max: Math.min(1000, Math.max(normalized.usageRange.min, normalized.usageRange.max)),
    };
  }

  return normalized;
};

const filtersToUrlParams = (filters: FilterState): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.categories.length > 0) {
    params.set('categories', filters.categories.join(','));
  }

  if (filters.dateRange.start) {
    params.set('dateStart', filters.dateRange.start.toISOString().split('T')[0]);
  }
  if (filters.dateRange.end) {
    params.set('dateEnd', filters.dateRange.end.toISOString().split('T')[0]);
  }

  if (filters.successRateRange.min > 0 || filters.successRateRange.max < 100) {
    params.set('successMin', filters.successRateRange.min.toString());
    params.set('successMax', filters.successRateRange.max.toString());
  }

  if (filters.usageRange.min > 0 || filters.usageRange.max < 1000) {
    params.set('usageMin', filters.usageRange.min.toString());
    params.set('usageMax', filters.usageRange.max.toString());
  }

  if (filters.tags.length > 0) {
    params.set('tags', filters.tags.join(','));
  }

  if (filters.searchQuery.trim()) {
    params.set('q', filters.searchQuery);
  }

  return params;
};

const urlParamsToFilters = (params: URLSearchParams): Partial<FilterState> => {
  const filters: Partial<FilterState> = {};

  const categories = params.get('categories');
  if (categories) {
    filters.categories = categories.split(',') as KBCategory[];
  }

  const dateStart = params.get('dateStart');
  const dateEnd = params.get('dateEnd');
  if (dateStart || dateEnd) {
    filters.dateRange = {
      start: dateStart ? new Date(dateStart) : null,
      end: dateEnd ? new Date(dateEnd) : null,
    };
  }

  const successMin = params.get('successMin');
  const successMax = params.get('successMax');
  if (successMin || successMax) {
    filters.successRateRange = {
      min: successMin ? parseInt(successMin) : 0,
      max: successMax ? parseInt(successMax) : 100,
    };
  }

  const usageMin = params.get('usageMin');
  const usageMax = params.get('usageMax');
  if (usageMin || usageMax) {
    filters.usageRange = {
      min: usageMin ? parseInt(usageMin) : 0,
      max: usageMax ? parseInt(usageMax) : 1000,
    };
  }

  const tags = params.get('tags');
  if (tags) {
    filters.tags = tags.split(',');
  }

  const searchQuery = params.get('q');
  if (searchQuery) {
    filters.searchQuery = searchQuery;
  }

  return filters;
};

// =====================
// Storage Functions
// =====================

const loadFilterPresets = (): FilterPreset[] => {
  try {
    const stored = localStorage.getItem(FILTER_PRESETS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((preset: any) => ({
        ...preset,
        createdAt: new Date(preset.createdAt),
        filters: {
          ...preset.filters,
          dateRange: {
            start: preset.filters.dateRange.start ? new Date(preset.filters.dateRange.start) : null,
            end: preset.filters.dateRange.end ? new Date(preset.filters.dateRange.end) : null,
          },
        },
      }));
    }
  } catch (error) {
    console.error('Failed to load filter presets:', error);
  }
  return [];
};

const saveFilterPresets = (presets: FilterPreset[]): void => {
  try {
    localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to save filter presets:', error);
  }
};

const loadFilterAnalytics = (): FilterAnalytics => {
  try {
    const stored = localStorage.getItem(FILTER_ANALYTICS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load filter analytics:', error);
  }
  return {
    totalChanges: 0,
    mostUsedFilters: [],
    averageFiltersPerSession: 0,
    filterCombinations: {},
    timeSpent: 0,
  };
};

const saveFilterAnalytics = (analytics: FilterAnalytics): void => {
  try {
    localStorage.setItem(FILTER_ANALYTICS_KEY, JSON.stringify(analytics));
  } catch (error) {
    console.error('Failed to save filter analytics:', error);
  }
};

// =====================
// Main Hook
// =====================

export const useFilters = (options: UseFiltersOptions = {}): UseFiltersReturn => {
  const {
    initialFilters = {},
    enableUrlSync = true,
    enableValidation = true,
    enableAnalytics = true,
    debounceDelay = 300,
  } = options;

  // =====================
  // State Management
  // =====================

  const [filters, setFilters] = useState<FilterState>(() => ({
    ...DEFAULT_FILTERS,
    ...normalizeFilters(initialFilters),
  }));

  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => loadFilterPresets());
  const [analytics, setAnalytics] = useState<FilterAnalytics>(() => loadFilterAnalytics());

  // Refs for tracking
  const sessionStartRef = useRef<number>(Date.now());
  const changeCountRef = useRef<number>(0);
  const filterUsageRef = useRef<Record<keyof FilterState, number>>({
    categories: 0,
    dateRange: 0,
    successRateRange: 0,
    usageRange: 0,
    tags: 0,
    searchQuery: 0,
  });

  // =====================
  // Computed Values
  // =====================

  const filtersState = useMemo(() => {
    const hasActiveFilters = (
      filters.categories.length > 0 ||
      filters.tags.length > 0 ||
      filters.dateRange.start !== null ||
      filters.dateRange.end !== null ||
      filters.successRateRange.min > 0 ||
      filters.successRateRange.max < 100 ||
      filters.usageRange.min > 0 ||
      filters.usageRange.max < 1000 ||
      filters.searchQuery.trim().length > 0
    );

    const filterCount = Object.values(filters).filter(value => {
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object' && value !== null) {
        if ('start' in value || 'end' in value) {
          return value.start !== null || value.end !== null;
        }
        if ('min' in value && 'max' in value) {
          return value.min > 0 || value.max < (value.max === 100 ? 100 : 1000);
        }
      }
      if (typeof value === 'string') return value.trim().length > 0;
      return false;
    }).length;

    const validation = enableValidation ? validateFilters(filters) : { isValid: true, errors: {}, warnings: {} };

    return {
      hasActiveFilters,
      filterCount,
      appliedFiltersCount: filterCount,
      isValid: validation.isValid,
    };
  }, [filters, enableValidation]);

  // =====================
  // Validation
  // =====================

  const validateFilters = useCallback((filters: FilterState): FilterValidationResult => {
    const errors: Record<keyof FilterState, string | null> = {
      categories: validateCategories(filters.categories),
      dateRange: validateDateRange(filters.dateRange.start, filters.dateRange.end),
      successRateRange: validateRange(filters.successRateRange, 0, 100),
      usageRange: validateRange(filters.usageRange, 0, 1000),
      tags: validateTags(filters.tags),
      searchQuery: validateSearchQuery(filters.searchQuery),
    };

    const warnings: Record<keyof FilterState, string | null> = {
      categories: null,
      dateRange: null,
      successRateRange: null,
      usageRange: null,
      tags: filters.tags.length > 10 ? 'Many tags selected - consider narrowing your search' : null,
      searchQuery: filters.searchQuery.length > 100 ? 'Long search query - consider using tags instead' : null,
    };

    const isValid = Object.values(errors).every(error => error === null);

    return { isValid, errors, warnings };
  }, []);

  // =====================
  // Actions
  // =====================

  const updateFilters = useCallback((updates: Partial<FilterState>) => {
    const normalized = normalizeFilters(updates);

    setFilters(prevFilters => {
      const newFilters = { ...prevFilters, ...normalized };

      // Analytics tracking
      if (enableAnalytics) {
        changeCountRef.current++;
        Object.keys(normalized).forEach(key => {
          filterUsageRef.current[key as keyof FilterState]++;
        });
      }

      return newFilters;
    });
  }, [enableAnalytics]);

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    updateFilters({ [key]: value });
  }, [updateFilters]);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const resetFilter = useCallback((key: keyof FilterState) => {
    updateFilters({ [key]: DEFAULT_FILTERS[key] });
  }, [updateFilters]);

  // =====================
  // Presets
  // =====================

  const saveFilterPreset = useCallback((name: string) => {
    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name,
      filters,
      createdAt: new Date(),
      usageCount: 0,
    };

    setFilterPresets(prev => {
      const updated = [...prev, newPreset];
      saveFilterPresets(updated);
      return updated;
    });
  }, [filters]);

  const loadFilterPreset = useCallback((name: string) => {
    const preset = filterPresets.find(p => p.name === name);
    if (preset) {
      setFilters(preset.filters);

      // Update usage count
      setFilterPresets(prev => {
        const updated = prev.map(p =>
          p.name === name
            ? { ...p, usageCount: p.usageCount + 1 }
            : p
        );
        saveFilterPresets(updated);
        return updated;
      });
    }
  }, [filterPresets]);

  const deleteFilterPreset = useCallback((name: string) => {
    setFilterPresets(prev => {
      const updated = prev.filter(p => p.name !== name);
      saveFilterPresets(updated);
      return updated;
    });
  }, []);

  const getFilterPresets = useCallback(() => filterPresets, [filterPresets]);

  // =====================
  // Analytics
  // =====================

  const getFilterAnalytics = useCallback((): FilterAnalytics => {
    const sessionTime = Date.now() - sessionStartRef.current;
    const mostUsedFilters = Object.entries(filterUsageRef.current)
      .map(([key, count]) => ({ key: key as keyof FilterState, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalChanges: changeCountRef.current,
      mostUsedFilters,
      averageFiltersPerSession: filtersState.filterCount,
      filterCombinations: analytics.filterCombinations,
      timeSpent: sessionTime,
    };
  }, [analytics.filterCombinations, filtersState.filterCount]);

  // =====================
  // URL Sync
  // =====================

  const getFilterUrl = useCallback((): string => {
    if (!enableUrlSync) return '';
    const params = filtersToUrlParams(filters);
    return params.toString();
  }, [filters, enableUrlSync]);

  const setFiltersFromUrl = useCallback((url: string) => {
    if (!enableUrlSync) return;
    try {
      const params = new URLSearchParams(url);
      const filtersFromUrl = urlParamsToFilters(params);
      updateFilters(filtersFromUrl);
    } catch (error) {
      console.error('Failed to parse filters from URL:', error);
    }
  }, [enableUrlSync, updateFilters]);

  // =====================
  // Effects
  // =====================

  // Save analytics on unmount
  useEffect(() => {
    return () => {
      if (enableAnalytics) {
        const currentAnalytics = getFilterAnalytics();
        saveFilterAnalytics(currentAnalytics);
      }
    };
  }, [enableAnalytics, getFilterAnalytics]);

  // Update URL when filters change
  useEffect(() => {
    if (enableUrlSync && typeof window !== 'undefined') {
      const params = filtersToUrlParams(filters);
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;

      // Update URL without triggering navigation
      if (window.location.pathname + window.location.search !== newUrl) {
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [filters, enableUrlSync]);

  // =====================
  // Return
  // =====================

  return {
    // Current state
    filters,
    filtersState,

    // Actions
    updateFilters,
    updateFilter,
    clearFilters,
    resetFilter,

    // Presets
    saveFilterPreset,
    loadFilterPreset,
    deleteFilterPreset,
    getFilterPresets,

    // Validation
    validateFilters,
    getFilterErrors: () => validateFilters(filters).errors,

    // Analytics
    getFilterAnalytics,

    // URL sync
    getFilterUrl,
    setFiltersFromUrl,
  };
};

export default useFilters;