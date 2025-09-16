/**
 * Unit tests for QueryBuilder
 * Tests SQL query generation with various filtering and sorting scenarios
 */

import { QueryBuilder } from '../../../../src/main/services/QueryBuilder';
import { ListingOptions, FilterCriteria } from '../../../../src/main/services/KBListingService';
import Database from 'better-sqlite3';
import { createTestDatabase, cleanupTestDatabase } from '../../helpers/test-database';

describe('QueryBuilder', () => {
  let queryBuilder: QueryBuilder;
  let testDb: Database.Database;

  beforeAll(() => {
    testDb = createTestDatabase();
    queryBuilder = new QueryBuilder(testDb);
  });

  afterAll(() => {
    cleanupTestDatabase(testDb);
  });

  // =========================
  // BASIC QUERY BUILDING
  // =========================

  describe('buildListingQuery()', () => {
    it('should build basic select query with default options', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'updated_at',
        sortDirection: 'desc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query).toMatchObject({
        sql: expect.stringContaining('SELECT'),
        sql: expect.stringContaining('FROM kb_entries'),
        sql: expect.stringContaining('ORDER BY updated_at DESC'),
        sql: expect.stringContaining('LIMIT 20 OFFSET 0'),
        params: expect.any(Array),
        countSql: expect.stringContaining('SELECT COUNT(*)'),
        countParams: expect.any(Array)
      });
    });

    it('should handle different page sizes and offsets', () => {
      const options: Required<ListingOptions> = {
        page: 3,
        pageSize: 15,
        offset: 30,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('LIMIT 15 OFFSET 30');
      expect(query.sql).toContain('ORDER BY title ASC');
    });

    it('should include archived entries when specified', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: true,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      // Should not filter out archived entries
      expect(query.sql).not.toContain('archived = 0');
      expect(query.sql).not.toContain('archived IS NULL');
    });

    it('should exclude archived entries by default', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      // Should filter out archived entries
      expect(query.sql).toContain('(archived = 0 OR archived IS NULL)');
    });
  });

  // =========================
  // SORTING TESTS
  // =========================

  describe('Sorting', () => {
    it('should handle all supported sort fields', () => {
      const sortFields = ['title', 'category', 'created_at', 'updated_at', 'usage_count', 'success_rate', 'last_used'];

      sortFields.forEach(sortField => {
        const options: Required<ListingOptions> = {
          page: 1,
          pageSize: 20,
          offset: 0,
          sortBy: sortField as any,
          sortDirection: 'desc',
          multiSort: [],
          filters: [],
          quickFilters: [],
          searchQuery: '',
          searchFields: ['all'],
          includeArchived: false,
          includeMetadata: true,
          includeStats: true
        };

        const query = queryBuilder.buildListingQuery(options);
        expect(query.sql).toContain(`ORDER BY ${sortField} DESC`);
      });
    });

    it('should handle multi-column sorting', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'category',
        sortDirection: 'asc',
        multiSort: ['title', 'updated_at'],
        filters: [],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('ORDER BY category ASC, title, updated_at');
    });

    it('should handle sorting with calculated fields', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'success_rate',
        sortDirection: 'desc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      // Should include calculation for success rate
      expect(query.sql).toContain('CASE WHEN (success_count + failure_count) > 0');
      expect(query.sql).toContain('ORDER BY success_rate DESC');
    });
  });

  // =========================
  // FILTERING TESTS
  // =========================

  describe('Filtering', () => {
    it('should handle equality filters', () => {
      const filters: FilterCriteria[] = [{
        field: 'category',
        operator: 'eq',
        value: 'VSAM'
      }];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('category = ?');
      expect(query.params).toContain('VSAM');
    });

    it('should handle IN filters', () => {
      const filters: FilterCriteria[] = [{
        field: 'category',
        operator: 'in',
        value: ['VSAM', 'JCL', 'DB2']
      }];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('category IN (?, ?, ?)');
      expect(query.params).toEqual(expect.arrayContaining(['VSAM', 'JCL', 'DB2']));
    });

    it('should handle range filters', () => {
      const filters: FilterCriteria[] = [
        {
          field: 'usage_count',
          operator: 'gte',
          value: 10
        },
        {
          field: 'usage_count',
          operator: 'lte',
          value: 100
        }
      ];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('usage_count >= ?');
      expect(query.sql).toContain('usage_count <= ?');
      expect(query.params).toEqual(expect.arrayContaining([10, 100]));
    });

    it('should handle BETWEEN filters', () => {
      const filters: FilterCriteria[] = [{
        field: 'created_at',
        operator: 'between',
        value: ['2024-01-01', '2024-12-31']
      }];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('created_at BETWEEN ? AND ?');
      expect(query.params).toEqual(expect.arrayContaining(['2024-01-01', '2024-12-31']));
    });

    it('should handle text filters', () => {
      const filters: FilterCriteria[] = [
        {
          field: 'title',
          operator: 'contains',
          value: 'error'
        },
        {
          field: 'problem',
          operator: 'starts_with',
          value: 'Job fails'
        }
      ];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('title LIKE ?');
      expect(query.sql).toContain('problem LIKE ?');
      expect(query.params).toEqual(expect.arrayContaining(['%error%', 'Job fails%']));
    });

    it('should handle NULL filters', () => {
      const filters: FilterCriteria[] = [
        {
          field: 'last_used',
          operator: 'is_null',
          value: null
        },
        {
          field: 'tags',
          operator: 'is_not_null',
          value: null
        }
      ];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('last_used IS NULL');
      expect(query.sql).toContain('tags IS NOT NULL');
    });

    it('should handle regex filters', () => {
      const filters: FilterCriteria[] = [{
        field: 'title',
        operator: 'regex',
        value: '^S0C[0-9]'
      }];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('title REGEXP ?');
      expect(query.params).toContain('^S0C[0-9]');
    });

    it('should combine multiple filters with AND logic', () => {
      const filters: FilterCriteria[] = [
        {
          field: 'category',
          operator: 'eq',
          value: 'VSAM'
        },
        {
          field: 'usage_count',
          operator: 'gte',
          value: 5
        },
        {
          field: 'created_at',
          operator: 'gte',
          value: '2024-01-01'
        }
      ];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('category = ?');
      expect(query.sql).toContain('usage_count >= ?');
      expect(query.sql).toContain('created_at >= ?');
      expect(query.sql).toMatch(/WHERE.*AND.*AND/);
    });
  });

  // =========================
  // SEARCH TESTS
  // =========================

  describe('Search Functionality', () => {
    it('should handle full-text search across all fields', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'relevance',
        sortDirection: 'desc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: 'database error',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('kb_fts');
      expect(query.sql).toContain('MATCH ?');
      expect(query.params).toContain('database error');
    });

    it('should handle search in specific fields', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: 'VSAM',
        searchFields: ['title', 'category'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('title LIKE ? OR category LIKE ?');
      expect(query.params).toEqual(expect.arrayContaining(['%VSAM%', '%VSAM%']));
    });

    it('should combine search with filters', () => {
      const filters: FilterCriteria[] = [{
        field: 'category',
        operator: 'eq',
        value: 'DB2'
      }];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'relevance',
        sortDirection: 'desc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: 'connection',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('kb_fts');
      expect(query.sql).toContain('MATCH ?');
      expect(query.sql).toContain('category = ?');
      expect(query.params).toEqual(expect.arrayContaining(['connection', 'DB2']));
    });

    it('should handle empty search query', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      // Should not include search clauses
      expect(query.sql).not.toContain('MATCH');
      expect(query.sql).not.toContain('kb_fts');
    });

    it('should escape special characters in search', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: 'test & "special" chars\'',
        searchFields: ['title'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      // Should handle special characters without breaking
      expect(query.sql).toContain('title LIKE ?');
      expect(query.params.some(param =>
        typeof param === 'string' && param.includes('special')
      )).toBe(true);
    });
  });

  // =========================
  // QUICK FILTERS TESTS
  // =========================

  describe('Quick Filters', () => {
    it('should handle recent quick filter', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'created_at',
        sortDirection: 'desc',
        multiSort: [],
        filters: [],
        quickFilters: ['recent'],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('created_at >= ?');
      expect(query.sql).toContain('ORDER BY created_at DESC');
    });

    it('should handle popular quick filter', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'usage_count',
        sortDirection: 'desc',
        multiSort: [],
        filters: [],
        quickFilters: ['popular'],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('usage_count > ?');
      expect(query.sql).toContain('ORDER BY usage_count DESC');
    });

    it('should handle highly rated quick filter', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'success_rate',
        sortDirection: 'desc',
        multiSort: [],
        filters: [],
        quickFilters: ['highly_rated'],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('success_rate >= ?');
      expect(query.sql).toContain('ORDER BY success_rate DESC');
    });

    it('should handle multiple quick filters', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'updated_at',
        sortDirection: 'desc',
        multiSort: [],
        filters: [],
        quickFilters: ['recent', 'popular'],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('created_at >= ?');
      expect(query.sql).toContain('usage_count > ?');
      expect(query.sql).toMatch(/WHERE.*AND/);
    });
  });

  // =========================
  // JOINS AND RELATIONSHIPS
  // =========================

  describe('Joins and Relationships', () => {
    it('should include tag relationships when needed', () => {
      const filters: FilterCriteria[] = [{
        field: 'tags',
        operator: 'contains',
        value: 'error'
      }];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('LEFT JOIN kb_tags');
      expect(query.sql).toContain('GROUP BY kb_entries.id');
    });

    it('should include metadata when requested', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toContain('success_count');
      expect(query.sql).toContain('failure_count');
      expect(query.sql).toContain('usage_count');
    });

    it('should optimize queries when metadata not needed', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: false,
        includeStats: false
      };

      const query = queryBuilder.buildListingQuery(options);

      // Should use simpler query structure
      expect(query.sql).not.toContain('LEFT JOIN usage_stats');
      expect(query.sql.match(/SELECT/g)?.length).toBe(1); // Only main SELECT
    });
  });

  // =========================
  // QUERY OPTIMIZATION
  // =========================

  describe('Query Optimization', () => {
    it('should use appropriate indexes for common queries', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'category',
        sortDirection: 'asc',
        multiSort: [],
        filters: [{
          field: 'category',
          operator: 'eq',
          value: 'VSAM'
        }],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      // Should structure query to use category index
      expect(query.sql).toMatch(/WHERE.*category = \?/);
      expect(query.sql).toContain('ORDER BY category');
    });

    it('should optimize count queries separately', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters: [{
          field: 'category',
          operator: 'in',
          value: ['VSAM', 'JCL']
        }],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      // Count query should be simpler
      expect(query.countSql).toContain('SELECT COUNT(*)');
      expect(query.countSql).not.toContain('ORDER BY');
      expect(query.countSql).not.toContain('LIMIT');
      expect(query.countParams).toEqual(expect.arrayContaining(['VSAM', 'JCL']));
    });

    it('should minimize subqueries when possible', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters: [{
          field: 'title',
          operator: 'contains',
          value: 'test'
        }],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: false,
        includeStats: false
      };

      const query = queryBuilder.buildListingQuery(options);

      // Should avoid unnecessary subqueries
      const subqueryCount = (query.sql.match(/SELECT/g) || []).length;
      expect(subqueryCount).toBeLessThanOrEqual(2); // Main query + possible FTS
    });
  });

  // =========================
  // ERROR HANDLING
  // =========================

  describe('Error Handling', () => {
    it('should handle invalid filter operators', () => {
      const filters: FilterCriteria[] = [{
        field: 'category',
        operator: 'invalid_op' as any,
        value: 'test'
      }];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      expect(() => queryBuilder.buildListingQuery(options)).toThrow();
    });

    it('should handle invalid sort fields', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'invalid_field' as any,
        sortDirection: 'asc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      expect(() => queryBuilder.buildListingQuery(options)).toThrow();
    });

    it('should sanitize SQL injection attempts', () => {
      const filters: FilterCriteria[] = [{
        field: 'title',
        operator: 'eq',
        value: "'; DROP TABLE kb_entries; --"
      }];

      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters,
        quickFilters: [],
        searchQuery: '',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      // Should use parameterized queries
      expect(query.sql).toContain('title = ?');
      expect(query.params).toContain("'; DROP TABLE kb_entries; --");
      expect(query.sql).not.toContain('DROP TABLE');
    });

    it('should handle empty filter arrays', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: [],
        filters: [],
        quickFilters: [],
        searchQuery: '',
        searchFields: [],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query = queryBuilder.buildListingQuery(options);

      expect(query.sql).toBeDefined();
      expect(query.params).toEqual(expect.any(Array));
      expect(query.countSql).toBeDefined();
    });
  });

  // =========================
  // PERFORMANCE TESTS
  // =========================

  describe('Performance', () => {
    it('should generate queries quickly', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'title',
        sortDirection: 'asc',
        multiSort: ['category', 'created_at'],
        filters: [
          { field: 'category', operator: 'in', value: ['VSAM', 'JCL', 'DB2'] },
          { field: 'usage_count', operator: 'gte', value: 5 },
          { field: 'created_at', operator: 'between', value: ['2024-01-01', '2024-12-31'] }
        ],
        quickFilters: ['recent', 'popular'],
        searchQuery: 'database error connection',
        searchFields: ['title', 'problem', 'solution'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const startTime = performance.now();
      const query = queryBuilder.buildListingQuery(options);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // Should complete in less than 10ms
      expect(query.sql).toBeDefined();
      expect(query.params).toBeDefined();
    });

    it('should generate consistent queries for same options', () => {
      const options: Required<ListingOptions> = {
        page: 1,
        pageSize: 20,
        offset: 0,
        sortBy: 'category',
        sortDirection: 'asc',
        multiSort: [],
        filters: [{ field: 'category', operator: 'eq', value: 'VSAM' }],
        quickFilters: [],
        searchQuery: 'test',
        searchFields: ['all'],
        includeArchived: false,
        includeMetadata: true,
        includeStats: true
      };

      const query1 = queryBuilder.buildListingQuery(options);
      const query2 = queryBuilder.buildListingQuery(options);

      expect(query1.sql).toBe(query2.sql);
      expect(query1.params).toEqual(query2.params);
    });
  });
});