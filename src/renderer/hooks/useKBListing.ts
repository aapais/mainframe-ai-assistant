/**
 * useKBListing Hook
 *
 * A comprehensive hook for managing KB entry listings with:
 * - Advanced filtering and searching
 * - Multi-column sorting with priority
 * - Pagination management
 * - Export functionality
 * - Real-time updates and caching
 * - Performance optimizations
 * - Error handling and retry logic
 *
 * @author Frontend Developer
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { KBEntry, KBCategory } from '../../types/services';
import { FilterState, SortConfig } from '../components/KBExplorer';
import { useKBData } from './useKBData';
import { useDebounce } from './useDebounce';

// =====================
// Types & Interfaces
// =====================

export interface UseKBListingOptions {
  filters: FilterState;
  pagination: {
    currentPage: number;
    pageSize: number;
  };
  sortConfig: SortConfig[];
  enableRealTimeUpdates?: boolean;
  enableCaching?: boolean;
  cacheTimeout?: number;
}

export interface UseKBListingReturn {
  // Data
  entries: KBEntry[];
  totalEntries: number;
  filteredCount: number;

  // State
  isLoading: boolean;
  error: string | null;

  // Sorting
  sortConfig: SortConfig[];
  updateSort: (column: keyof KBEntry, direction: 'asc' | 'desc', addToSort?: boolean) => void;
  clearSort: () => void;

  // Operations
  refresh: () => Promise<void>;
  exportData: (entries: KBEntry[], format: string, options: any) => Promise<void>;

  // Statistics
  categoryStats: Record<KBCategory, number>;
  tagStats: Record<string, number>;
  dateRange: { min: Date | null; max: Date | null };
  usageStats: { min: number; max: number; average: number };
  successRateStats: { min: number; max: number; average: number };
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf' | 'excel' | 'html';
  fields: (keyof KBEntry)[];
  includeHeaders: boolean;
  filename?: string;
  [key: string]: any;
}

// =====================
// Helper Functions
// =====================

const applyFilters = (entries: KBEntry[], filters: FilterState): KBEntry[] => {
  return entries.filter(entry => {
    // Category filter
    if (filters.categories.length > 0 && !filters.categories.includes(entry.category)) {
      return false;
    }

    // Tags filter
    if (filters.tags.length > 0) {
      const entryTags = entry.tags || [];
      if (!filters.tags.some(tag => entryTags.includes(tag))) {
        return false;
      }
    }

    // Date range filter
    if (filters.dateRange.start && new Date(entry.created_at) < filters.dateRange.start) {
      return false;
    }
    if (filters.dateRange.end && new Date(entry.created_at) > filters.dateRange.end) {
      return false;
    }

    // Success rate filter
    const totalUsage = (entry.success_count || 0) + (entry.failure_count || 0);
    if (totalUsage > 0) {
      const successRate = ((entry.success_count || 0) / totalUsage) * 100;
      if (successRate < filters.successRateRange.min || successRate > filters.successRateRange.max) {
        return false;
      }
    } else if (filters.successRateRange.min > 0 || filters.successRateRange.max < 100) {
      // If no usage data and success rate filter is applied, exclude entry
      return false;
    }

    // Usage count filter
    const usageCount = entry.usage_count || 0;
    if (usageCount < filters.usageRange.min ||
        (filters.usageRange.max < 1000 && usageCount > filters.usageRange.max)) {
      return false;
    }

    // Text search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      const searchableText = [
        entry.title,
        entry.problem,
        entry.solution,
        entry.category,
        ...(entry.tags || [])
      ].join(' ').toLowerCase();

      if (!searchableText.includes(query)) {
        return false;
      }
    }

    return true;
  });
};

const applySorting = (entries: KBEntry[], sortConfig: SortConfig[]): KBEntry[] => {
  if (sortConfig.length === 0) {
    // Default sort by updated_at desc
    return [...entries].sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  return [...entries].sort((a, b) => {
    for (const sort of sortConfig) {
      let aValue: any = a[sort.column];
      let bValue: any = b[sort.column];

      // Handle null/undefined values
      if (aValue == null && bValue == null) continue;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Type-specific comparison
      if (sort.column === 'created_at' || sort.column === 'updated_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      else if (aValue > bValue) comparison = 1;

      if (comparison !== 0) {
        return sort.direction === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  });
};

const generateCSV = (entries: KBEntry[], options: any): string => {
  const { fields, includeHeaders, csvOptions } = options;
  const { delimiter = ',', quoteChar = '"', includeUTF8BOM = true } = csvOptions || {};

  const escape = (value: any): string => {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(delimiter) || str.includes(quoteChar) || str.includes('\n')) {
      return `${quoteChar}${str.replace(new RegExp(quoteChar, 'g'), quoteChar + quoteChar)}${quoteChar}`;
    }
    return str;
  };

  const formatValue = (entry: KBEntry, field: keyof KBEntry): string => {
    const value = entry[field];
    if (Array.isArray(value)) return value.join('; ');
    if (value instanceof Date) return value.toISOString();
    return String(value || '');
  };

  const lines: string[] = [];

  if (includeHeaders) {
    const headers = fields.map(field => escape(field));
    lines.push(headers.join(delimiter));
  }

  entries.forEach(entry => {
    const row = fields.map(field => escape(formatValue(entry, field)));
    lines.push(row.join(delimiter));
  });

  const csv = lines.join('\n');
  return includeUTF8BOM ? '\uFEFF' + csv : csv;
};

const generateJSON = (entries: KBEntry[], options: any): string => {
  const { jsonOptions } = options;
  const { indent = 2, minified = false } = jsonOptions || {};

  const data = {
    meta: {
      exportDate: new Date().toISOString(),
      entryCount: entries.length,
      version: '1.0'
    },
    entries
  };

  return minified ? JSON.stringify(data) : JSON.stringify(data, null, indent);
};

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// =====================
// Main Hook
// =====================

export const useKBListing = (options: UseKBListingOptions): UseKBListingReturn => {
  const {
    filters,
    pagination,
    sortConfig: initialSortConfig,
    enableRealTimeUpdates = true,
    enableCaching = true,
    cacheTimeout = 5 * 60 * 1000, // 5 minutes
  } = options;

  // =====================
  // State Management
  // =====================

  const [sortConfig, setSortConfig] = useState<SortConfig[]>(initialSortConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<Map<string, { data: KBEntry[]; timestamp: number }>>(new Map());

  // Get data from KB context
  const { state: kbState, loadEntries, refreshEntries } = useKBData();
  const allEntries = useMemo(() => Array.from(kbState.entries.values()), [kbState.entries]);

  // Debounce expensive operations
  const debouncedFilters = useDebounce(filters, 300);
  const lastFilterHashRef = useRef<string>('');

  // =====================
  // Computed Values
  // =====================

  // Generate cache key for current filters
  const cacheKey = useMemo(() => {
    return JSON.stringify({
      filters: debouncedFilters,
      sortConfig
    });
  }, [debouncedFilters, sortConfig]);

  // Apply filtering and sorting
  const processedEntries = useMemo(() => {
    const startTime = performance.now();

    // Check cache first
    if (enableCaching && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < cacheTimeout) {
        console.debug(`Cache hit for KB listing (${performance.now() - startTime}ms)`);
        return cached.data;
      }
    }

    // Apply filters
    const filtered = applyFilters(allEntries, debouncedFilters);

    // Apply sorting
    const sorted = applySorting(filtered, sortConfig);

    // Apply pagination
    const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
    const paginated = sorted.slice(startIndex, startIndex + pagination.pageSize);

    // Update cache
    if (enableCaching) {
      setCache(prev => {
        const newCache = new Map(prev);
        newCache.set(cacheKey, { data: paginated, timestamp: Date.now() });

        // Clean old cache entries
        const cutoff = Date.now() - cacheTimeout;
        for (const [key, value] of newCache) {
          if (value.timestamp < cutoff) {
            newCache.delete(key);
          }
        }

        return newCache;
      });
    }

    console.debug(`Processed ${allEntries.length} entries -> ${filtered.length} filtered -> ${paginated.length} paginated (${performance.now() - startTime}ms)`);

    return paginated;
  }, [allEntries, debouncedFilters, sortConfig, pagination, cacheKey, cache, enableCaching, cacheTimeout]);

  // Get filtered count (without pagination)
  const filteredCount = useMemo(() => {
    return applyFilters(allEntries, debouncedFilters).length;
  }, [allEntries, debouncedFilters]);

  // Statistics
  const statistics = useMemo(() => {
    const filtered = applyFilters(allEntries, debouncedFilters);

    // Category stats
    const categoryStats: Record<KBCategory, number> = {
      'JCL': 0,
      'VSAM': 0,
      'DB2': 0,
      'Batch': 0,
      'Functional': 0,
      'Other': 0
    };

    // Tag stats
    const tagStats: Record<string, number> = {};

    // Date range
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    // Usage stats
    const usageCounts: number[] = [];
    const successRates: number[] = [];

    filtered.forEach(entry => {
      // Category
      categoryStats[entry.category]++;

      // Tags
      (entry.tags || []).forEach(tag => {
        tagStats[tag] = (tagStats[tag] || 0) + 1;
      });

      // Dates
      const date = new Date(entry.created_at);
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;

      // Usage
      const usage = entry.usage_count || 0;
      usageCounts.push(usage);

      // Success rate
      const total = (entry.success_count || 0) + (entry.failure_count || 0);
      if (total > 0) {
        successRates.push((entry.success_count || 0) / total * 100);
      }
    });

    return {
      categoryStats,
      tagStats,
      dateRange: { min: minDate, max: maxDate },
      usageStats: {
        min: Math.min(...usageCounts, 0),
        max: Math.max(...usageCounts, 0),
        average: usageCounts.length > 0 ? usageCounts.reduce((a, b) => a + b, 0) / usageCounts.length : 0
      },
      successRateStats: {
        min: Math.min(...successRates, 0),
        max: Math.max(...successRates, 100),
        average: successRates.length > 0 ? successRates.reduce((a, b) => a + b, 0) / successRates.length : 0
      }
    };
  }, [allEntries, debouncedFilters]);

  // =====================
  // Event Handlers
  // =====================

  const updateSort = useCallback((column: keyof KBEntry, direction: 'asc' | 'desc', addToSort: boolean = false) => {
    setSortConfig(prev => {
      if (!addToSort) {
        // Single column sort
        return [{ column, direction, priority: 0 }];
      }

      // Multi-column sort
      const existing = prev.find(s => s.column === column);
      if (existing) {
        // Update existing sort
        return prev.map((s, index) =>
          s.column === column
            ? { ...s, direction }
            : s
        );
      } else {
        // Add new sort
        return [...prev, { column, direction, priority: prev.length }];
      }
    });
  }, []);

  const clearSort = useCallback(() => {
    setSortConfig([]);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await refreshEntries();

      // Clear cache
      setCache(new Map());

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh entries';
      setError(errorMessage);
      console.error('Failed to refresh KB entries:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshEntries]);

  const exportData = useCallback(async (
    entries: KBEntry[],
    format: string,
    options: ExportOptions
  ) => {
    try {
      let content: string;
      let mimeType: string;
      let extension: string;

      switch (format) {
        case 'csv':
          content = generateCSV(entries, options);
          mimeType = 'text/csv;charset=utf-8';
          extension = 'csv';
          break;

        case 'json':
          content = generateJSON(entries, options);
          mimeType = 'application/json;charset=utf-8';
          extension = 'json';
          break;

        case 'html':
          // Generate HTML table
          const fields = options.fields;
          const includeHeaders = options.includeHeaders;

          let html = '<!DOCTYPE html><html><head><title>KB Export</title>';
          html += '<style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background-color:#f2f2f2}</style>';
          html += '</head><body><h1>Knowledge Base Export</h1>';
          html += `<p>Exported on ${new Date().toLocaleDateString()}</p>`;
          html += '<table>';

          if (includeHeaders) {
            html += '<tr>' + fields.map(field => `<th>${field}</th>`).join('') + '</tr>';
          }

          entries.forEach(entry => {
            html += '<tr>';
            fields.forEach(field => {
              let value = entry[field];
              if (Array.isArray(value)) value = value.join(', ');
              if (value instanceof Date) value = value.toLocaleDateString();
              html += `<td>${String(value || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
            });
            html += '</tr>';
          });

          html += '</table></body></html>';
          content = html;
          mimeType = 'text/html;charset=utf-8';
          extension = 'html';
          break;

        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      const filename = `${options.filename || 'kb-export'}.${extension}`;
      downloadFile(content, filename, mimeType);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      console.error('Export failed:', err);
      throw new Error(errorMessage);
    }
  }, []);

  // =====================
  // Effects
  // =====================

  // Initial load
  useEffect(() => {
    if (allEntries.length === 0) {
      loadEntries();
    }
  }, [allEntries.length, loadEntries]);

  // Clear error when filters change
  useEffect(() => {
    setError(null);
  }, [debouncedFilters]);

  // =====================
  // Return
  // =====================

  return {
    // Data
    entries: processedEntries,
    totalEntries: allEntries.length,
    filteredCount,

    // State
    isLoading: isLoading || kbState.isLoading,
    error: error || kbState.error,

    // Sorting
    sortConfig,
    updateSort,
    clearSort,

    // Operations
    refresh,
    exportData,

    // Statistics
    ...statistics
  };
};

export default useKBListing;