/**
 * Unit tests for KBListingService
 * Tests all service methods with comprehensive scenarios
 */

import { KBListingService, ListingOptions, ListingResponse } from '../../../../src/main/services/KBListingService';
import { DatabaseService } from '../../../../src/main/services/DatabaseService';
import { KBEntry } from '../../../../src/types';
import Database from 'better-sqlite3';
import { createTestDatabase, seedTestData, cleanupTestDatabase } from '../../helpers/test-database';
import { generateMockKBEntries } from '../../helpers/mock-data-generator';

describe('KBListingService', () => {
  let service: KBListingService;
  let databaseService: DatabaseService;
  let testDb: Database.Database;
  let testEntries: KBEntry[];

  beforeAll(async () => {
    // Setup test database
    testDb = createTestDatabase();
    databaseService = {
      getDatabase: () => ({ db: testDb })
    } as DatabaseService;

    // Generate test data
    testEntries = generateMockKBEntries(100);
    await seedTestData(testDb, testEntries);

    // Create service instance
    service = new KBListingService(databaseService);
  });

  afterAll(async () => {
    await cleanupTestDatabase(testDb);
  });

  beforeEach(() => {
    // Clear cache before each test
    service['cache'].clear();
  });

  // =========================
  // BASIC LISTING TESTS
  // =========================

  describe('getEntries()', () => {
    it('should return paginated entries with default options', async () => {
      const result = await service.getEntries();

      expect(result).toMatchObject({
        items: expect.any(Array),
        pagination: {
          currentPage: 1,
          pageSize: 20,
          totalItems: expect.any(Number),
          totalPages: expect.any(Number),
          hasNext: expect.any(Boolean),
          hasPrevious: false
        },
        sorting: {
          sortBy: 'updated_at',
          sortDirection: 'desc',
          availableSorts: expect.any(Array)
        },
        filtering: {
          activeFilters: [],
          availableFilters: expect.any(Array),
          quickFilters: expect.any(Array)
        },
        aggregations: expect.any(Object),
        metadata: {
          totalTime: expect.any(Number),
          cacheHit: false,
          queryComplexity: expect.any(Number)
        }
      });

      expect(result.items.length).toBeLessThanOrEqual(20);
      expect(result.pagination.totalItems).toBe(100);
    });

    it('should handle custom pagination options', async () => {
      const options: ListingOptions = {
        page: 2,
        pageSize: 10
      };

      const result = await service.getEntries(options);

      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.pageSize).toBe(10);
      expect(result.items.length).toBeLessThanOrEqual(10);
      expect(result.pagination.hasPrevious).toBe(true);
    });

    it('should enforce maximum page size limit', async () => {
      const options: ListingOptions = {
        pageSize: 200 // Exceeds limit
      };

      const result = await service.getEntries(options);

      expect(result.pagination.pageSize).toBe(100); // Should be clamped to max
    });

    it('should handle empty results gracefully', async () => {
      // Create service with empty database
      const emptyDb = createTestDatabase();
      const emptyService = new KBListingService({
        getDatabase: () => ({ db: emptyDb })
      } as DatabaseService);

      const result = await emptyService.getEntries();

      expect(result.items).toEqual([]);
      expect(result.pagination.totalItems).toBe(0);
      expect(result.pagination.totalPages).toBe(0);

      emptyDb.close();
    });
  });

  // =========================
  // SORTING TESTS
  // =========================

  describe('Sorting', () => {
    it('should sort by title ascending', async () => {
      const options: ListingOptions = {
        sortBy: 'title',
        sortDirection: 'asc',
        pageSize: 10
      };

      const result = await service.getEntries(options);

      const titles = result.items.map(item => item.title);
      const sortedTitles = [...titles].sort();
      expect(titles).toEqual(sortedTitles);
    });

    it('should sort by creation date descending', async () => {
      const options: ListingOptions = {
        sortBy: 'created_at',
        sortDirection: 'desc',
        pageSize: 10
      };

      const result = await service.getEntries(options);

      const dates = result.items.map(item => new Date(item.created_at!).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });

    it('should sort by usage count descending', async () => {
      const options: ListingOptions = {
        sortBy: 'usage_count',
        sortDirection: 'desc',
        pageSize: 10
      };

      const result = await service.getEntries(options);

      const usageCounts = result.items.map(item => item.usage_count || 0);
      for (let i = 1; i < usageCounts.length; i++) {
        expect(usageCounts[i]).toBeLessThanOrEqual(usageCounts[i - 1]);
      }
    });

    it('should include all available sort options', async () => {
      const result = await service.getEntries();

      expect(result.sorting.availableSorts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'title', label: 'Title' }),
          expect.objectContaining({ field: 'category', label: 'Category' }),
          expect.objectContaining({ field: 'created_at', label: 'Created Date' }),
          expect.objectContaining({ field: 'updated_at', label: 'Last Updated' }),
          expect.objectContaining({ field: 'usage_count', label: 'Usage Count' }),
          expect.objectContaining({ field: 'success_rate', label: 'Success Rate' })
        ])
      );
    });
  });

  // =========================
  // FILTERING TESTS
  // =========================

  describe('Filtering', () => {
    it('should filter by category', async () => {
      const options: ListingOptions = {
        filters: [{
          field: 'category',
          operator: 'eq',
          value: 'VSAM'
        }]
      };

      const result = await service.getEntries(options);

      expect(result.items.every(item => item.category === 'VSAM')).toBe(true);
      expect(result.filtering.activeFilters).toHaveLength(1);
      expect(result.filtering.activeFilters[0].field).toBe('category');
    });

    it('should filter by multiple categories', async () => {
      const options: ListingOptions = {
        filters: [{
          field: 'category',
          operator: 'in',
          value: ['VSAM', 'JCL']
        }]
      };

      const result = await service.getEntries(options);

      expect(result.items.every(item =>
        ['VSAM', 'JCL'].includes(item.category!)
      )).toBe(true);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const options: ListingOptions = {
        filters: [{
          field: 'created_at',
          operator: 'between',
          value: [startDate.toISOString(), endDate.toISOString()]
        }]
      };

      const result = await service.getEntries(options);

      result.items.forEach(item => {
        const itemDate = new Date(item.created_at!);
        expect(itemDate).toBeAfterOrEqual(startDate);
        expect(itemDate).toBeBeforeOrEqual(endDate);
      });
    });

    it('should filter by usage count range', async () => {
      const options: ListingOptions = {
        filters: [{
          field: 'usage_count',
          operator: 'gte',
          value: 10
        }]
      };

      const result = await service.getEntries(options);

      expect(result.items.every(item =>
        (item.usage_count || 0) >= 10
      )).toBe(true);
    });

    it('should handle text search filters', async () => {
      const options: ListingOptions = {
        filters: [{
          field: 'title',
          operator: 'contains',
          value: 'Error'
        }]
      };

      const result = await service.getEntries(options);

      expect(result.items.every(item =>
        item.title.toLowerCase().includes('error')
      )).toBe(true);
    });

    it('should combine multiple filters with AND logic', async () => {
      const options: ListingOptions = {
        filters: [
          {
            field: 'category',
            operator: 'eq',
            value: 'VSAM'
          },
          {
            field: 'usage_count',
            operator: 'gte',
            value: 5
          }
        ]
      };

      const result = await service.getEntries(options);

      expect(result.items.every(item =>
        item.category === 'VSAM' && (item.usage_count || 0) >= 5
      )).toBe(true);
    });
  });

  // =========================
  // SEARCH TESTS
  // =========================

  describe('Search', () => {
    it('should perform full-text search', async () => {
      const options: ListingOptions = {
        searchQuery: 'database',
        searchFields: ['all']
      };

      const result = await service.getEntries(options);

      expect(result.items.every(item =>
        item.title.toLowerCase().includes('database') ||
        item.problem?.toLowerCase().includes('database') ||
        item.solution?.toLowerCase().includes('database')
      )).toBe(true);
    });

    it('should search specific fields only', async () => {
      const options: ListingOptions = {
        searchQuery: 'error',
        searchFields: ['title']
      };

      const result = await service.getEntries(options);

      expect(result.items.every(item =>
        item.title.toLowerCase().includes('error')
      )).toBe(true);
    });

    it('should combine search with filters', async () => {
      const options: ListingOptions = {
        searchQuery: 'status',
        filters: [{
          field: 'category',
          operator: 'eq',
          value: 'VSAM'
        }]
      };

      const result = await service.getEntries(options);

      expect(result.items.every(item =>
        item.category === 'VSAM' &&
        (item.title.toLowerCase().includes('status') ||
         item.problem?.toLowerCase().includes('status') ||
         item.solution?.toLowerCase().includes('status'))
      )).toBe(true);
    });
  });

  // =========================
  // QUICK FILTERS TESTS
  // =========================

  describe('Quick Filters', () => {
    it('should return quick filter options with counts', async () => {
      const quickFilters = await service.getQuickFilters();

      expect(quickFilters).toEqual(
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
          }),
          expect.objectContaining({
            type: 'highly_rated',
            label: 'Highly Rated',
            count: expect.any(Number),
            active: false
          })
        ])
      );
    });

    it('should apply recent quick filter', async () => {
      const options: ListingOptions = {
        quickFilters: ['recent']
      };

      const result = await service.getEntries(options);

      // Should be sorted by creation date descending
      const dates = result.items.map(item => new Date(item.created_at!).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });

    it('should apply popular quick filter', async () => {
      const options: ListingOptions = {
        quickFilters: ['popular']
      };

      const result = await service.getEntries(options);

      // Should be sorted by usage count descending
      const usageCounts = result.items.map(item => item.usage_count || 0);
      for (let i = 1; i < usageCounts.length; i++) {
        expect(usageCounts[i]).toBeLessThanOrEqual(usageCounts[i - 1]);
      }
    });
  });

  // =========================
  // AGGREGATIONS TESTS
  // =========================

  describe('Aggregations', () => {
    it('should return category statistics', async () => {
      const result = await service.getEntries();

      expect(result.aggregations.categoryStats).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: expect.any(String),
            count: expect.any(Number),
            percentage: expect.any(Number),
            avgRating: expect.any(Number),
            avgUsage: expect.any(Number)
          })
        ])
      );
    });

    it('should return tag cloud data', async () => {
      const result = await service.getEntries();

      expect(result.aggregations.tagCloud).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tag: expect.any(String),
            count: expect.any(Number),
            popularity: expect.any(Number),
            trendDirection: expect.stringMatching(/^(up|down|stable)$/)
          })
        ])
      );
    });

    it('should return usage statistics', async () => {
      const result = await service.getEntries();

      expect(result.aggregations.usageStats).toEqual({
        totalViews: expect.any(Number),
        uniqueUsers: expect.any(Number),
        avgSessionTime: expect.any(Number),
        bounceRate: expect.any(Number),
        conversionRate: expect.any(Number)
      });
    });
  });

  // =========================
  // PERFORMANCE TESTS
  // =========================

  describe('Performance & Caching', () => {
    it('should cache results and return cached data on subsequent calls', async () => {
      const options: ListingOptions = {
        page: 1,
        pageSize: 10
      };

      // First call - should not be cached
      const result1 = await service.getEntries(options);
      expect(result1.metadata.cacheHit).toBe(false);

      // Second call with same options - should be cached
      const result2 = await service.getEntries(options);
      expect(result2.metadata.cacheHit).toBe(true);

      // Results should be identical
      expect(result1.items).toEqual(result2.items);
    });

    it('should complete queries within performance threshold', async () => {
      const startTime = performance.now();

      await service.getEntries({ pageSize: 50 });

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should provide query complexity analysis', async () => {
      const simpleQuery = await service.getEntries({ page: 1 });
      const complexQuery = await service.getEntries({
        filters: [
          { field: 'category', operator: 'in', value: ['VSAM', 'JCL', 'DB2'] },
          { field: 'created_at', operator: 'between', value: ['2024-01-01', '2024-12-31'] },
          { field: 'usage_count', operator: 'gte', value: 5 }
        ],
        searchQuery: 'database error',
        sortBy: 'usage_count'
      });

      expect(complexQuery.metadata.queryComplexity)
        .toBeGreaterThan(simpleQuery.metadata.queryComplexity);
    });

    it('should invalidate cache when appropriate', async () => {
      const options: ListingOptions = { page: 1, pageSize: 5 };

      // Get cached result
      await service.getEntries(options);
      const cachedResult = await service.getEntries(options);
      expect(cachedResult.metadata.cacheHit).toBe(true);

      // Clear cache and verify it's invalidated
      service['invalidateCache']();
      const uncachedResult = await service.getEntries(options);
      expect(uncachedResult.metadata.cacheHit).toBe(false);
    });
  });

  // =========================
  // ERROR HANDLING TESTS
  // =========================

  describe('Error Handling', () => {
    it('should handle invalid filter operators', async () => {
      const options: ListingOptions = {
        filters: [{
          field: 'category',
          operator: 'invalid_operator' as any,
          value: 'test'
        }]
      };

      await expect(service.getEntries(options)).rejects.toThrow();
    });

    it('should handle invalid sort fields', async () => {
      const options: ListingOptions = {
        sortBy: 'invalid_field' as any
      };

      await expect(service.getEntries(options)).rejects.toThrow();
    });

    it('should handle database connection errors gracefully', async () => {
      // Create service with invalid database
      const invalidService = new KBListingService({
        getDatabase: () => null
      } as any);

      await expect(invalidService.getEntries()).rejects.toThrow();
    });

    it('should validate page parameters', async () => {
      const options: ListingOptions = {
        page: -1,
        pageSize: 0
      };

      const result = await service.getEntries(options);

      // Should normalize invalid values
      expect(result.pagination.currentPage).toBeGreaterThan(0);
      expect(result.pagination.pageSize).toBeGreaterThan(0);
    });
  });

  // =========================
  // FILTER OPTIONS TESTS
  // =========================

  describe('getFilterOptions()', () => {
    it('should return all available filter options', async () => {
      const options = await service.getFilterOptions();

      expect(options).toEqual(
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
          }),
          expect.objectContaining({
            field: 'usage_count',
            label: 'Usage Count',
            type: 'range',
            min: expect.any(Number),
            max: expect.any(Number)
          })
        ])
      );
    });

    it('should include option counts for select filters', async () => {
      const options = await service.getFilterOptions();
      const categoryFilter = options.find(opt => opt.field === 'category');

      expect(categoryFilter?.options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            value: expect.any(String),
            label: expect.any(String),
            count: expect.any(Number)
          })
        ])
      );
    });

    it('should cache filter options', async () => {
      // First call
      const options1 = await service.getFilterOptions();

      // Second call should be faster (cached)
      const startTime = performance.now();
      const options2 = await service.getFilterOptions();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // Should be very fast from cache
      expect(options1).toEqual(options2);
    });
  });

  // =========================
  // EDGE CASES
  // =========================

  describe('Edge Cases', () => {
    it('should handle empty search query', async () => {
      const options: ListingOptions = {
        searchQuery: '',
        searchFields: ['all']
      };

      const result = await service.getEntries(options);

      // Should return all entries when search is empty
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('should handle very large page numbers', async () => {
      const options: ListingOptions = {
        page: 999999,
        pageSize: 10
      };

      const result = await service.getEntries(options);

      // Should return empty results but valid structure
      expect(result.items).toEqual([]);
      expect(result.pagination.currentPage).toBe(999999);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('should handle special characters in search', async () => {
      const options: ListingOptions = {
        searchQuery: 'test & "special" chars\'',
        searchFields: ['all']
      };

      // Should not throw an error
      await expect(service.getEntries(options)).resolves.toBeDefined();
    });

    it('should handle concurrent requests', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        service.getEntries({ page: i + 1, pageSize: 5 })
      );

      const results = await Promise.all(promises);

      results.forEach((result, index) => {
        expect(result.pagination.currentPage).toBe(index + 1);
        expect(result.items.length).toBeLessThanOrEqual(5);
      });
    });
  });
});

// =========================
// CUSTOM JEST MATCHERS
// =========================

expect.extend({
  toBeAfterOrEqual(received: Date, expected: Date) {
    return {
      message: () =>
        `expected ${received.toISOString()} to be after or equal to ${expected.toISOString()}`,
      pass: received >= expected,
    };
  },
  toBeBeforeOrEqual(received: Date, expected: Date) {
    return {
      message: () =>
        `expected ${received.toISOString()} to be before or equal to ${expected.toISOString()}`,
      pass: received <= expected,
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeAfterOrEqual(expected: Date): R;
      toBeBeforeOrEqual(expected: Date): R;
    }
  }
}