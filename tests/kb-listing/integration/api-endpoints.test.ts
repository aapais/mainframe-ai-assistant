/**
 * Integration tests for KB Listing API endpoints
 * Tests complete API workflows with real data flow
 */

import { KBListingAPI } from '../../../src/main/api/KBListingAPI';
import { KBListingService, ListingOptions } from '../../../src/main/services/KBListingService';
import { DatabaseService } from '../../../src/main/services/DatabaseService';
import { createTestDatabase, seedRealisticData, cleanupTestDatabase } from '../helpers/test-database';
import { generateMockKBEntries, generateMockListingOptions } from '../helpers/mock-data-generator';
import Database from 'better-sqlite3';

// Mock IPC for testing
const mockIpcHandlers = new Map();
const mockIpcMain = {
  handle: jest.fn((channel, handler) => {
    mockIpcHandlers.set(channel, handler);
  })
};

// Mock event object
const mockEvent = {};

describe('KB Listing API Integration', () => {
  let db: Database.Database;
  let databaseService: DatabaseService;
  let listingService: KBListingService;
  let api: KBListingAPI;

  beforeAll(async () => {
    // Setup test database with realistic data
    db = createTestDatabase({ memory: true, verbose: false });
    await seedRealisticData(db);

    // Setup services
    databaseService = {
      getDatabase: () => ({ db })
    } as DatabaseService;

    listingService = new KBListingService(databaseService);

    // Mock ipcMain globally
    (global as any).require = jest.fn((module) => {
      if (module === 'electron') {
        return { ipcMain: mockIpcMain };
      }
    });

    // Initialize API
    api = new KBListingAPI(databaseService);
  });

  afterAll(() => {
    cleanupTestDatabase(db);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================
  // CORE LISTING ENDPOINTS
  // =========================

  describe('Core Listing Endpoints', () => {
    it('should handle get-entries with default options', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-entries');
      expect(handler).toBeDefined();

      const result = await handler(mockEvent, {});

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        items: expect.any(Array),
        pagination: expect.objectContaining({
          currentPage: 1,
          pageSize: expect.any(Number),
          totalItems: expect.any(Number)
        }),
        sorting: expect.objectContaining({
          sortBy: expect.any(String),
          sortDirection: expect.stringMatching(/^(asc|desc)$/)
        }),
        metadata: expect.objectContaining({
          totalTime: expect.any(Number),
          cacheHit: expect.any(Boolean)
        })
      });
    });

    it('should handle get-entries with complex filtering', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-entries');

      const complexOptions: ListingOptions = {
        page: 2,
        pageSize: 5,
        sortBy: 'usage_count',
        sortDirection: 'desc',
        filters: [
          {
            field: 'category',
            operator: 'in',
            value: ['VSAM', 'JCL']
          },
          {
            field: 'usage_count',
            operator: 'gte',
            value: 10
          }
        ],
        searchQuery: 'error',
        quickFilters: ['popular']
      };

      const result = await handler(mockEvent, complexOptions);

      expect(result.success).toBe(true);
      expect(result.data.pagination.currentPage).toBe(2);
      expect(result.data.pagination.pageSize).toBe(5);

      // All items should match filters
      result.data.items.forEach((item: any) => {
        expect(['VSAM', 'JCL']).toContain(item.category);
        expect(item.usage_count).toBeGreaterThanOrEqual(10);
        expect(
          item.title.toLowerCase().includes('error') ||
          item.problem?.toLowerCase().includes('error') ||
          item.solution?.toLowerCase().includes('error')
        ).toBe(true);
      });
    });

    it('should handle get-count endpoint', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-count');
      expect(handler).toBeDefined();

      const result = await handler(mockEvent, {});

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        total: expect.any(Number),
        filtered: expect.any(Number)
      });

      expect(result.data.total).toBeGreaterThan(0);
      expect(result.data.filtered).toBeGreaterThan(0);
    });

    it('should handle get-count with filters', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-count');

      const options: ListingOptions = {
        filters: [{
          field: 'category',
          operator: 'eq',
          value: 'VSAM'
        }]
      };

      const result = await handler(mockEvent, options);

      expect(result.success).toBe(true);
      expect(result.data.filtered).toBeLessThanOrEqual(result.data.total);
    });

    it('should handle errors gracefully', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-entries');

      // Simulate database error by closing connection
      const originalDb = databaseService.getDatabase;
      databaseService.getDatabase = () => null as any;

      const result = await handler(mockEvent, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.code).toBe('FETCH_ENTRIES_ERROR');

      // Restore connection
      databaseService.getDatabase = originalDb;
    });
  });

  // =========================
  // FILTERING ENDPOINTS
  // =========================

  describe('Filtering Endpoints', () => {
    it('should handle get-filter-options', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-filter-options');
      expect(handler).toBeDefined();

      const result = await handler(mockEvent, {});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'category',
            label: 'Category',
            type: 'multiselect',
            options: expect.any(Array)
          }),
          expect.objectContaining({
            field: 'created_at',
            label: 'Created Date',
            type: 'date'
          })
        ])
      );

      // Category options should have counts
      const categoryFilter = result.data.find((f: any) => f.field === 'category');
      expect(categoryFilter.options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            value: expect.any(String),
            label: expect.any(String),
            count: expect.any(Number)
          })
        ])
      );
    });

    it('should handle get-quick-filters', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-quick-filters');
      expect(handler).toBeDefined();

      const result = await handler(mockEvent);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'recent',
            label: 'Recently Added',
            count: expect.any(Number),
            active: false
          }),
          expect.objectContaining({
            type: 'popular',
            label: 'Most Popular',
            count: expect.any(Number),
            active: false
          })
        ])
      );
    });

    it('should validate filters correctly', async () => {
      const handler = mockIpcHandlers.get('kb-listing:validate-filters');
      expect(handler).toBeDefined();

      const validFilters = [
        {
          field: 'category',
          operator: 'eq',
          value: 'VSAM'
        }
      ];

      const invalidFilters = [
        {
          field: '', // Missing field
          operator: 'eq',
          value: 'test'
        },
        {
          field: 'category',
          operator: 'between',
          value: 'single_value' // Should be array
        }
      ];

      // Test valid filters
      let result = await handler(mockEvent, validFilters);
      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(true);
      expect(result.data.results[0].valid).toBe(true);

      // Test invalid filters
      result = await handler(mockEvent, invalidFilters);
      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(false);
      expect(result.data.results[0].valid).toBe(false);
      expect(result.data.results[0].errors.length).toBeGreaterThan(0);
    });
  });

  // =========================
  // SORTING ENDPOINTS
  // =========================

  describe('Sorting Endpoints', () => {
    it('should handle get-sort-options', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-sort-options');
      expect(handler).toBeDefined();

      const result = await handler(mockEvent);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            label: 'Title',
            defaultDirection: 'asc',
            description: expect.any(String)
          }),
          expect.objectContaining({
            field: 'usage_count',
            label: 'Usage Count',
            defaultDirection: 'desc',
            description: expect.any(String)
          })
        ])
      );
    });
  });

  // =========================
  // AGGREGATION ENDPOINTS
  // =========================

  describe('Aggregation Endpoints', () => {
    it('should handle get-aggregations', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-aggregations');
      expect(handler).toBeDefined();

      const result = await handler(mockEvent, {});

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        categoryStats: expect.arrayContaining([
          expect.objectContaining({
            category: expect.any(String),
            count: expect.any(Number),
            percentage: expect.any(Number),
            avgRating: expect.any(Number)
          })
        ]),
        tagCloud: expect.any(Array),
        usageStats: expect.objectContaining({
          totalViews: expect.any(Number),
          uniqueUsers: expect.any(Number)
        })
      });
    });

    it('should handle get-category-stats', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-category-stats');
      expect(handler).toBeDefined();

      // Test without category filter
      let result = await handler(mockEvent);
      expect(result.success).toBe(true);
      expect(result.data.categoryStats).toEqual(expect.any(Array));

      // Test with specific category
      result = await handler(mockEvent, 'VSAM');
      expect(result.success).toBe(true);
      expect(result.data.totalEntries).toEqual(expect.any(Number));
    });
  });

  // =========================
  // EXPORT ENDPOINTS
  // =========================

  describe('Export Endpoints', () => {
    it('should handle export with default format', async () => {
      const handler = mockIpcHandlers.get('kb-listing:export');
      expect(handler).toBeDefined();

      const options: ListingOptions = {
        page: 1,
        pageSize: 10
      };

      const result = await handler(mockEvent, options, 'csv');

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        success: expect.any(Boolean),
        filePath: expect.any(String),
        size: expect.any(Number),
        duration: expect.any(Number)
      });
    });

    it('should handle get-export-formats', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-export-formats');
      expect(handler).toBeDefined();

      const result = await handler(mockEvent);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            format: 'csv',
            label: expect.stringContaining('CSV'),
            options: expect.any(Object)
          }),
          expect.objectContaining({
            format: 'json',
            label: expect.stringContaining('JSON'),
            options: expect.any(Object)
          })
        ])
      );
    });
  });

  // =========================
  // PERFORMANCE ENDPOINTS
  // =========================

  describe('Performance Endpoints', () => {
    it('should handle get-performance-stats', async () => {
      const handler = mockIpcHandlers.get('kb-listing:get-performance-stats');
      expect(handler).toBeDefined();

      const result = await handler(mockEvent);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        averageQueryTime: expect.any(Number),
        cacheHitRate: expect.any(Number),
        slowQueries: expect.any(Array),
        indexUsage: expect.any(Object),
        recommendations: expect.any(Array)
      });
    });
  });

  // =========================
  // COMPREHENSIVE WORKFLOW TESTS
  // =========================

  describe('Complete Workflow Tests', () => {
    it('should handle complete search and filter workflow', async () => {
      const getEntriesHandler = mockIpcHandlers.get('kb-listing:get-entries');
      const getFilterOptionsHandler = mockIpcHandlers.get('kb-listing:get-filter-options');

      // 1. Get available filter options
      const filterOptionsResult = await getFilterOptionsHandler(mockEvent, {});
      expect(filterOptionsResult.success).toBe(true);

      const categoryFilter = filterOptionsResult.data.find((f: any) => f.field === 'category');
      const availableCategories = categoryFilter.options.map((opt: any) => opt.value);

      // 2. Apply filters based on available options
      const filterOptions: ListingOptions = {
        page: 1,
        pageSize: 10,
        filters: [{
          field: 'category',
          operator: 'in',
          value: availableCategories.slice(0, 2) // Use first two available categories
        }],
        sortBy: 'usage_count',
        sortDirection: 'desc'
      };

      const entriesResult = await getEntriesHandler(mockEvent, filterOptions);
      expect(entriesResult.success).toBe(true);

      // 3. Verify results match applied filters
      entriesResult.data.items.forEach((item: any) => {
        expect(availableCategories.slice(0, 2)).toContain(item.category);
      });

      // 4. Check pagination
      expect(entriesResult.data.pagination.currentPage).toBe(1);
      expect(entriesResult.data.pagination.pageSize).toBe(10);

      // 5. Verify sorting
      const usageCounts = entriesResult.data.items.map((item: any) => item.usage_count || 0);
      for (let i = 1; i < usageCounts.length; i++) {
        expect(usageCounts[i]).toBeLessThanOrEqual(usageCounts[i - 1]);
      }
    });

    it('should handle pagination workflow', async () => {
      const getEntriesHandler = mockIpcHandlers.get('kb-listing:get-entries');

      // Page 1
      const page1Result = await getEntriesHandler(mockEvent, { page: 1, pageSize: 3 });
      expect(page1Result.success).toBe(true);
      expect(page1Result.data.pagination.currentPage).toBe(1);
      expect(page1Result.data.pagination.hasPrevious).toBe(false);

      const totalPages = page1Result.data.pagination.totalPages;

      if (totalPages > 1) {
        // Page 2
        const page2Result = await getEntriesHandler(mockEvent, { page: 2, pageSize: 3 });
        expect(page2Result.success).toBe(true);
        expect(page2Result.data.pagination.currentPage).toBe(2);
        expect(page2Result.data.pagination.hasPrevious).toBe(true);
        expect(page2Result.data.pagination.hasNext).toBe(totalPages > 2);

        // Ensure different results
        const page1Ids = page1Result.data.items.map((item: any) => item.id);
        const page2Ids = page2Result.data.items.map((item: any) => item.id);
        const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
        expect(overlap).toHaveLength(0);
      }
    });

    it('should handle search with progressive refinement', async () => {
      const getEntriesHandler = mockIpcHandlers.get('kb-listing:get-entries');

      // Broad search
      const broadResult = await getEntriesHandler(mockEvent, {
        searchQuery: 'error',
        searchFields: ['all']
      });
      expect(broadResult.success).toBe(true);
      const broadCount = broadResult.data.pagination.totalItems;

      // Refined search
      const refinedResult = await getEntriesHandler(mockEvent, {
        searchQuery: 'VSAM error',
        searchFields: ['all']
      });
      expect(refinedResult.success).toBe(true);
      const refinedCount = refinedResult.data.pagination.totalItems;

      // Refined search should return fewer or equal results
      expect(refinedCount).toBeLessThanOrEqual(broadCount);

      // Very specific search
      const specificResult = await getEntriesHandler(mockEvent, {
        searchQuery: 'VSAM error status',
        searchFields: ['title', 'problem'],
        filters: [{
          field: 'category',
          operator: 'eq',
          value: 'VSAM'
        }]
      });
      expect(specificResult.success).toBe(true);
      const specificCount = specificResult.data.pagination.totalItems;

      // Should be most restrictive
      expect(specificCount).toBeLessThanOrEqual(refinedCount);
    });

    it('should maintain performance under load', async () => {
      const getEntriesHandler = mockIpcHandlers.get('kb-listing:get-entries');

      // Simulate concurrent requests
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => ({
        page: i + 1,
        pageSize: 5,
        sortBy: i % 2 === 0 ? 'title' : 'created_at',
        sortDirection: i % 3 === 0 ? 'asc' : 'desc'
      }));

      const startTime = performance.now();

      const results = await Promise.all(
        concurrentRequests.map(options =>
          getEntriesHandler(mockEvent, options)
        )
      );

      const duration = performance.now() - startTime;

      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data.items).toEqual(expect.any(Array));
      });

      // Should complete within reasonable time (10 requests < 2 seconds)
      expect(duration).toBeLessThan(2000);

      // Each request should have correct pagination
      results.forEach((result, index) => {
        expect(result.data.pagination.currentPage).toBe(index + 1);
        expect(result.data.pagination.pageSize).toBe(5);
      });
    });

    it('should handle edge cases gracefully', async () => {
      const getEntriesHandler = mockIpcHandlers.get('kb-listing:get-entries');

      // Very large page number
      const largePageResult = await getEntriesHandler(mockEvent, {
        page: 999,
        pageSize: 10
      });
      expect(largePageResult.success).toBe(true);
      expect(largePageResult.data.items).toHaveLength(0);
      expect(largePageResult.data.pagination.currentPage).toBe(999);

      // Zero page size (should be normalized)
      const zeroPageSizeResult = await getEntriesHandler(mockEvent, {
        page: 1,
        pageSize: 0
      });
      expect(zeroPageSizeResult.success).toBe(true);
      expect(zeroPageSizeResult.data.pagination.pageSize).toBeGreaterThan(0);

      // Empty filters array
      const emptyFiltersResult = await getEntriesHandler(mockEvent, {
        filters: [],
        quickFilters: []
      });
      expect(emptyFiltersResult.success).toBe(true);
      expect(emptyFiltersResult.data.items).toEqual(expect.any(Array));

      // Invalid sort field (should use default)
      const invalidSortResult = await getEntriesHandler(mockEvent, {
        sortBy: 'invalid_field' as any
      });
      expect(invalidSortResult.success).toBe(true);
      expect(invalidSortResult.data.sorting.sortBy).not.toBe('invalid_field');
    });
  });

  // =========================
  // ERROR RECOVERY TESTS
  // =========================

  describe('Error Recovery', () => {
    it('should recover from transient database errors', async () => {
      const getEntriesHandler = mockIpcHandlers.get('kb-listing:get-entries');

      // Temporarily break database connection
      const originalGetDb = databaseService.getDatabase;
      let callCount = 0;

      databaseService.getDatabase = () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Transient database error');
        }
        return originalGetDb();
      };

      // First call should fail
      const failResult = await getEntriesHandler(mockEvent, {});
      expect(failResult.success).toBe(false);
      expect(failResult.error).toContain('Transient database error');

      // Second call should succeed
      const successResult = await getEntriesHandler(mockEvent, {});
      expect(successResult.success).toBe(true);
      expect(successResult.data.items).toEqual(expect.any(Array));

      // Restore original method
      databaseService.getDatabase = originalGetDb;
    });

    it('should handle malformed request data', async () => {
      const getEntriesHandler = mockIpcHandlers.get('kb-listing:get-entries');

      const malformedOptions = {
        page: 'not a number',
        filters: 'not an array',
        sortDirection: 'invalid_direction'
      };

      const result = await getEntriesHandler(mockEvent, malformedOptions);

      // Should handle gracefully with reasonable defaults
      expect(result.success).toBe(true);
      expect(result.data.pagination.currentPage).toEqual(expect.any(Number));
    });

    it('should provide meaningful error messages', async () => {
      const validateFiltersHandler = mockIpcHandlers.get('kb-listing:validate-filters');

      const problematicFilters = [
        {
          field: 'category',
          operator: 'between',
          value: 'single_value' // Should be array for between
        },
        {
          field: 'usage_count',
          operator: 'in',
          value: 'not_an_array' // Should be array for in
        }
      ];

      const result = await validateFiltersHandler(mockEvent, problematicFilters);

      expect(result.success).toBe(true);
      expect(result.data.isValid).toBe(false);

      result.data.results.forEach((validation: any, index: number) => {
        expect(validation.valid).toBe(false);
        expect(validation.errors).toEqual(expect.any(Array));
        expect(validation.errors.length).toBeGreaterThan(0);
        expect(validation.errors[0]).toEqual(expect.any(String));
      });
    });
  });
});