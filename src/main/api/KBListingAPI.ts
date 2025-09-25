/**
 * RESTful API Endpoints for KB Listing and Filtering
 * Provides comprehensive REST API with advanced querying capabilities
 */

import { ipcMain } from 'electron';
import { KBListingService, ListingOptions, SavedSearchCreate } from '../services/KBListingService';
import { DatabaseService } from '../services/DatabaseService';

export class KBListingAPI {
  private listingService: KBListingService;

  constructor(databaseService: DatabaseService) {
    this.listingService = new KBListingService(databaseService);
    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    // =========================
    // CORE LISTING ENDPOINTS
    // =========================

    /**
     * GET /api/kb/entries
     * Get paginated, filtered, and sorted KB entries
     */
    ipcMain.handle('kb-listing:get-entries', async (event, options: ListingOptions = {}) => {
      try {
        return await this.listingService.getEntries(options);
      } catch (error) {
        console.error('Error fetching KB entries:', error);
        return {
          success: false,
          error: error.message,
          code: 'FETCH_ENTRIES_ERROR',
        };
      }
    });

    /**
     * GET /api/kb/entries/count
     * Get total count of entries matching filters
     */
    ipcMain.handle('kb-listing:get-count', async (event, options: Partial<ListingOptions> = {}) => {
      try {
        const response = await this.listingService.getEntries({ ...options, pageSize: 1 });
        return {
          success: true,
          data: {
            total: response.pagination.totalItems,
            filtered: response.pagination.totalItems,
          },
        };
      } catch (error) {
        console.error('Error fetching entry count:', error);
        return {
          success: false,
          error: error.message,
          code: 'FETCH_COUNT_ERROR',
        };
      }
    });

    // =========================
    // FILTERING ENDPOINTS
    // =========================

    /**
     * GET /api/kb/filters/options
     * Get available filter options with counts
     */
    ipcMain.handle(
      'kb-listing:get-filter-options',
      async (event, context: Partial<ListingOptions> = {}) => {
        try {
          const options = await this.listingService.getFilterOptions(context);
          return {
            success: true,
            data: options,
          };
        } catch (error) {
          console.error('Error fetching filter options:', error);
          return {
            success: false,
            error: error.message,
            code: 'FETCH_FILTER_OPTIONS_ERROR',
          };
        }
      }
    );

    /**
     * GET /api/kb/filters/quick
     * Get quick filter options with counts
     */
    ipcMain.handle('kb-listing:get-quick-filters', async event => {
      try {
        const quickFilters = await this.listingService.getQuickFilters();
        return {
          success: true,
          data: quickFilters,
        };
      } catch (error) {
        console.error('Error fetching quick filters:', error);
        return {
          success: false,
          error: error.message,
          code: 'FETCH_QUICK_FILTERS_ERROR',
        };
      }
    });

    /**
     * POST /api/kb/filters/validate
     * Validate filter criteria before applying
     */
    ipcMain.handle('kb-listing:validate-filters', async (event, filters: any[]) => {
      try {
        const validationResults = filters.map(filter => this.validateFilter(filter));
        const isValid = validationResults.every(result => result.valid);

        return {
          success: true,
          data: {
            isValid,
            results: validationResults,
          },
        };
      } catch (error) {
        console.error('Error validating filters:', error);
        return {
          success: false,
          error: error.message,
          code: 'VALIDATE_FILTERS_ERROR',
        };
      }
    });

    // =========================
    // SORTING ENDPOINTS
    // =========================

    /**
     * GET /api/kb/sort/options
     * Get available sort options
     */
    ipcMain.handle('kb-listing:get-sort-options', async event => {
      try {
        const sortOptions = this.getSortOptions();
        return {
          success: true,
          data: sortOptions,
        };
      } catch (error) {
        console.error('Error fetching sort options:', error);
        return {
          success: false,
          error: error.message,
          code: 'FETCH_SORT_OPTIONS_ERROR',
        };
      }
    });

    // =========================
    // AGGREGATION ENDPOINTS
    // =========================

    /**
     * GET /api/kb/aggregations
     * Get aggregated data for dashboards and analytics
     */
    ipcMain.handle(
      'kb-listing:get-aggregations',
      async (event, options: Partial<ListingOptions> = {}) => {
        try {
          const response = await this.listingService.getEntries({ ...options, pageSize: 0 });
          return {
            success: true,
            data: response.aggregations,
          };
        } catch (error) {
          console.error('Error fetching aggregations:', error);
          return {
            success: false,
            error: error.message,
            code: 'FETCH_AGGREGATIONS_ERROR',
          };
        }
      }
    );

    /**
     * GET /api/kb/stats/category
     * Get category-specific statistics
     */
    ipcMain.handle('kb-listing:get-category-stats', async (event, category?: string) => {
      try {
        const options: ListingOptions = category
          ? {
              filters: [{ field: 'category', operator: 'eq', value: category }],
            }
          : {};

        const response = await this.listingService.getEntries(options);
        return {
          success: true,
          data: {
            categoryStats: response.aggregations.categoryStats,
            totalEntries: response.pagination.totalItems,
          },
        };
      } catch (error) {
        console.error('Error fetching category stats:', error);
        return {
          success: false,
          error: error.message,
          code: 'FETCH_CATEGORY_STATS_ERROR',
        };
      }
    });

    // =========================
    // EXPORT ENDPOINTS
    // =========================

    /**
     * POST /api/kb/export
     * Export entries in various formats
     */
    ipcMain.handle(
      'kb-listing:export',
      async (
        event,
        options: ListingOptions,
        format: 'csv' | 'json' | 'xlsx' = 'csv',
        config?: any
      ) => {
        try {
          const result = await this.listingService.exportEntries(options, format, config);
          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('Error exporting entries:', error);
          return {
            success: false,
            error: error.message,
            code: 'EXPORT_ERROR',
          };
        }
      }
    );

    /**
     * GET /api/kb/export/formats
     * Get available export formats and their configurations
     */
    ipcMain.handle('kb-listing:get-export-formats', async event => {
      try {
        const formats = [
          {
            format: 'csv',
            label: 'CSV (Comma Separated Values)',
            description: 'Spreadsheet-compatible format',
            options: {
              delimiter: { type: 'select', values: [',', ';', '\t'], default: ',' },
              includeHeaders: { type: 'boolean', default: true },
              dateFormat: { type: 'select', values: ['ISO', 'US', 'EU'], default: 'ISO' },
            },
          },
          {
            format: 'json',
            label: 'JSON (JavaScript Object Notation)',
            description: 'Structured data format',
            options: {
              pretty: { type: 'boolean', default: true },
              includeMetadata: { type: 'boolean', default: false },
            },
          },
          {
            format: 'xlsx',
            label: 'Excel Spreadsheet',
            description: 'Microsoft Excel format',
            options: {
              sheetName: { type: 'string', default: 'KB Entries' },
              includeCharts: { type: 'boolean', default: false },
            },
          },
        ];

        return {
          success: true,
          data: formats,
        };
      } catch (error) {
        console.error('Error fetching export formats:', error);
        return {
          success: false,
          error: error.message,
          code: 'FETCH_EXPORT_FORMATS_ERROR',
        };
      }
    });

    // =========================
    // SAVED SEARCHES ENDPOINTS
    // =========================

    /**
     * POST /api/kb/saved-searches
     * Save a search configuration
     */
    ipcMain.handle(
      'kb-listing:save-search',
      async (event, data: SavedSearchCreate, userId?: string) => {
        try {
          const searchId = await this.listingService.saveSearch(data, userId);
          return {
            success: true,
            data: { id: searchId },
          };
        } catch (error) {
          console.error('Error saving search:', error);
          return {
            success: false,
            error: error.message,
            code: 'SAVE_SEARCH_ERROR',
          };
        }
      }
    );

    /**
     * GET /api/kb/saved-searches
     * Get saved searches for a user
     */
    ipcMain.handle(
      'kb-listing:get-saved-searches',
      async (event, userId?: string, includePublic: boolean = true) => {
        try {
          const searches = await this.listingService.getSavedSearches(userId, includePublic);
          return {
            success: true,
            data: searches,
          };
        } catch (error) {
          console.error('Error fetching saved searches:', error);
          return {
            success: false,
            error: error.message,
            code: 'FETCH_SAVED_SEARCHES_ERROR',
          };
        }
      }
    );

    /**
     * POST /api/kb/saved-searches/:id/execute
     * Execute a saved search
     */
    ipcMain.handle(
      'kb-listing:execute-saved-search',
      async (event, searchId: string, overrides?: Partial<ListingOptions>) => {
        try {
          const results = await this.listingService.executeSavedSearch(searchId, overrides);
          return {
            success: true,
            data: results,
          };
        } catch (error) {
          console.error('Error executing saved search:', error);
          return {
            success: false,
            error: error.message,
            code: 'EXECUTE_SAVED_SEARCH_ERROR',
          };
        }
      }
    );

    /**
     * DELETE /api/kb/saved-searches/:id
     * Delete a saved search
     */
    ipcMain.handle(
      'kb-listing:delete-saved-search',
      async (event, searchId: string, userId?: string) => {
        try {
          const success = await this.listingService.deleteSavedSearch(searchId, userId);
          return {
            success,
            data: { deleted: success },
          };
        } catch (error) {
          console.error('Error deleting saved search:', error);
          return {
            success: false,
            error: error.message,
            code: 'DELETE_SAVED_SEARCH_ERROR',
          };
        }
      }
    );

    // =========================
    // PERFORMANCE ENDPOINTS
    // =========================

    /**
     * GET /api/kb/performance/stats
     * Get performance statistics for listing queries
     */
    ipcMain.handle('kb-listing:get-performance-stats', async event => {
      try {
        // Implementation would gather performance metrics
        const stats = {
          averageQueryTime: 0,
          cacheHitRate: 0,
          slowQueries: [],
          indexUsage: {},
          recommendations: [],
        };

        return {
          success: true,
          data: stats,
        };
      } catch (error) {
        console.error('Error fetching performance stats:', error);
        return {
          success: false,
          error: error.message,
          code: 'FETCH_PERFORMANCE_STATS_ERROR',
        };
      }
    });

    // =========================
    // BATCH OPERATIONS
    // =========================

    /**
     * POST /api/kb/batch/update-metadata
     * Batch update entry metadata based on filters
     */
    ipcMain.handle(
      'kb-listing:batch-update',
      async (event, filters: any[], updates: any, options?: { dryRun?: boolean }) => {
        try {
          // Implementation would perform batch updates
          const result = {
            affectedCount: 0,
            success: true,
            dryRun: options?.dryRun || false,
            changes: [],
          };

          return {
            success: true,
            data: result,
          };
        } catch (error) {
          console.error('Error in batch update:', error);
          return {
            success: false,
            error: error.message,
            code: 'BATCH_UPDATE_ERROR',
          };
        }
      }
    );
  }

  // =========================
  // PRIVATE HELPER METHODS
  // =========================

  private validateFilter(filter: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate required fields
    if (!filter.field) {
      errors.push('Filter field is required');
    }

    if (!filter.operator) {
      errors.push('Filter operator is required');
    }

    if (filter.value === undefined && !['is_null', 'is_not_null'].includes(filter.operator)) {
      errors.push('Filter value is required for this operator');
    }

    // Validate operator-specific requirements
    if (
      filter.operator === 'between' &&
      (!Array.isArray(filter.value) || filter.value.length !== 2)
    ) {
      errors.push('Between operator requires an array of exactly 2 values');
    }

    if (['in', 'not_in'].includes(filter.operator) && !Array.isArray(filter.value)) {
      errors.push('In/Not In operators require an array of values');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private getSortOptions() {
    return [
      {
        field: 'title',
        label: 'Title',
        defaultDirection: 'asc',
        description: 'Sort by entry title alphabetically',
      },
      {
        field: 'category',
        label: 'Category',
        defaultDirection: 'asc',
        description: 'Sort by mainframe component category',
      },
      {
        field: 'created_at',
        label: 'Created Date',
        defaultDirection: 'desc',
        description: 'Sort by entry creation date',
      },
      {
        field: 'updated_at',
        label: 'Last Updated',
        defaultDirection: 'desc',
        description: 'Sort by last modification date',
      },
      {
        field: 'usage_count',
        label: 'Usage Count',
        defaultDirection: 'desc',
        description: 'Sort by how often the entry is accessed',
      },
      {
        field: 'success_rate',
        label: 'Success Rate',
        defaultDirection: 'desc',
        description: 'Sort by user-reported success rate',
      },
      {
        field: 'last_used',
        label: 'Last Used',
        defaultDirection: 'desc',
        description: 'Sort by when the entry was last accessed',
      },
      {
        field: 'relevance',
        label: 'Relevance',
        defaultDirection: 'desc',
        description: 'Sort by search relevance score',
      },
    ];
  }
}

// =========================
// TYPE DEFINITIONS FOR API RESPONSES
// =========================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  metadata?: {
    timestamp: string;
    requestId?: string;
    version: string;
  };
}

export interface PaginatedAPIResponse<T = any> extends APIResponse<T> {
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// =========================
// ERROR HANDLING UTILITIES
// =========================

export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export const APIErrorCodes = {
  FETCH_ENTRIES_ERROR: 'FETCH_ENTRIES_ERROR',
  FETCH_COUNT_ERROR: 'FETCH_COUNT_ERROR',
  FETCH_FILTER_OPTIONS_ERROR: 'FETCH_FILTER_OPTIONS_ERROR',
  FETCH_QUICK_FILTERS_ERROR: 'FETCH_QUICK_FILTERS_ERROR',
  VALIDATE_FILTERS_ERROR: 'VALIDATE_FILTERS_ERROR',
  FETCH_SORT_OPTIONS_ERROR: 'FETCH_SORT_OPTIONS_ERROR',
  FETCH_AGGREGATIONS_ERROR: 'FETCH_AGGREGATIONS_ERROR',
  FETCH_CATEGORY_STATS_ERROR: 'FETCH_CATEGORY_STATS_ERROR',
  EXPORT_ERROR: 'EXPORT_ERROR',
  FETCH_EXPORT_FORMATS_ERROR: 'FETCH_EXPORT_FORMATS_ERROR',
  SAVE_SEARCH_ERROR: 'SAVE_SEARCH_ERROR',
  FETCH_SAVED_SEARCHES_ERROR: 'FETCH_SAVED_SEARCHES_ERROR',
  EXECUTE_SAVED_SEARCH_ERROR: 'EXECUTE_SAVED_SEARCH_ERROR',
  DELETE_SAVED_SEARCH_ERROR: 'DELETE_SAVED_SEARCH_ERROR',
  FETCH_PERFORMANCE_STATS_ERROR: 'FETCH_PERFORMANCE_STATS_ERROR',
  BATCH_UPDATE_ERROR: 'BATCH_UPDATE_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
