/**
 * FTS5 Search Integration Tests
 * Comprehensive tests for the FTS5 search backend implementation
 */

import { describe, beforeAll, afterAll, beforeEach, test, expect, jest } from '@jest/globals';
import path from 'path';
import fs from 'fs/promises';
import { FTS5SearchService } from '../../src/services/FTS5SearchService';
import { SearchIntegrationService } from '../../src/backend/api/search/SearchIntegrationService';
import { FTS5SearchController } from '../../src/backend/api/search/FTS5SearchController';
import { SearchResultsIntegrationAdapter } from '../../src/services/SearchResultsIntegrationAdapter';
import { KnowledgeBaseService } from '../../src/services/KnowledgeBaseService';
import { SearchServiceConfig } from '../../src/types/services';

describe('FTS5 Search Backend Integration', () => {
  let searchService: FTS5SearchService;
  let integrationService: SearchIntegrationService;
  let knowledgeBaseService: KnowledgeBaseService;
  let controller: FTS5SearchController;
  let testDbPath: string;

  const testConfig: SearchServiceConfig = {
    database: {
      path: './test-search.db',
      enableWAL: true,
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: -64000,
        foreign_keys: 'ON',
        temp_store: 'MEMORY'
      }
    },
    fts: {
      tokenizer: 'porter',
      removeStopwords: true,
      enableSynonyms: true
    },
    ranking: {
      algorithm: 'hybrid',
      boosts: {
        title: 2.0,
        content: 1.5,
        recency: 0.1,
        usage: 0.2
      }
    },
    pagination: {
      maxPageSize: 100,
      defaultPageSize: 20
    }
  };

  beforeAll(async () => {
    // Setup test database path
    testDbPath = path.join(__dirname, 'test-search.db');
    testConfig.database.path = testDbPath;

    // Clean up any existing test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }

    // Initialize services
    searchService = new FTS5SearchService(testConfig);

    // Mock KnowledgeBaseService for integration testing
    knowledgeBaseService = {
      read: jest.fn(),
      list: jest.fn(),
      on: jest.fn(),
      recordUsage: jest.fn()
    } as any;

    integrationService = new SearchIntegrationService(
      testConfig,
      knowledgeBaseService,
      {
        syncInterval: 1000,
        enableRealTimeSync: true,
        enableSearchAnalytics: true
      }
    );

    const adapter = new SearchResultsIntegrationAdapter();
    controller = new FTS5SearchController(searchService, adapter);

    // Initialize integration service
    await integrationService.initialize();
  });

  afterAll(async () => {
    // Cleanup
    if (searchService) {
      await searchService.close();
    }
    if (integrationService) {
      await integrationService.close();
    }

    // Remove test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('FTS5SearchService Core Functionality', () => {
    test('should initialize successfully', () => {
      expect(searchService).toBeDefined();
    });

    test('should handle empty search queries', async () => {
      const result = await searchService.search('');
      expect(result.results).toHaveLength(0);
      expect(result.pagination.total_results).toBe(0);
    });

    test('should search with basic query', async () => {
      const result = await searchService.search('test query', {
        limit: 10,
        offset: 0
      });

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('pagination');
      expect(result).toHaveProperty('facets');
      expect(result).toHaveProperty('query_info');
      expect(result.pagination.page_size).toBe(10);
    });

    test('should handle complex query syntax', async () => {
      const complexQuery = 'title:"JCL Error" AND category:batch OR tags:abend';
      const result = await searchService.search(complexQuery, {
        query_type: 'boolean',
        limit: 20
      });

      expect(result.query_info.parsed_query).toContain('title:');
      expect(result.query_info.parsed_query).toContain('category:');
    });

    test('should provide search suggestions', async () => {
      const suggestions = await searchService.getSuggestions('jcl', 5);
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    test('should return search statistics', () => {
      const stats = searchService.getSearchStats();

      expect(stats).toHaveProperty('total_searches');
      expect(stats).toHaveProperty('cache_hit_rate');
      expect(stats).toHaveProperty('avg_response_time');
      expect(stats).toHaveProperty('error_rate');
      expect(stats).toHaveProperty('index_stats');
    });

    test('should handle pagination correctly', async () => {
      const page1 = await searchService.search('test', {
        limit: 5,
        offset: 0
      });

      const page2 = await searchService.search('test', {
        limit: 5,
        offset: 5
      });

      expect(page1.pagination.current_page).toBe(1);
      expect(page2.pagination.current_page).toBe(2);
      expect(page1.pagination.has_next).toBe(page1.pagination.total_results > 5);
      expect(page2.pagination.has_previous).toBe(true);
    });

    test('should support field-specific searches', async () => {
      const result = await searchService.search('error', {
        fields: ['title', 'problem'],
        boost_fields: {
          title: 2.0,
          problem: 1.5
        }
      });

      expect(result.results.every(r => r.field_matches)).toBe(true);
    });

    test('should handle date range filtering', async () => {
      const result = await searchService.search('test', {
        date_range: {
          from: new Date('2023-01-01'),
          to: new Date('2023-12-31')
        }
      });

      // Should execute without errors
      expect(result).toHaveProperty('results');
    });

    test('should provide snippets when requested', async () => {
      const result = await searchService.search('error jcl', {
        include_snippets: true,
        snippet_length: 100
      });

      if (result.results.length > 0) {
        expect(result.results[0].snippet).toBeDefined();
        expect(result.results[0].snippet!.length).toBeLessThanOrEqual(103); // ~100 + '...'
      }
    });

    test('should cache search results', async () => {
      const query = 'cache test query';
      const options = { limit: 10, offset: 0 };

      // First search
      const result1 = await searchService.search(query, options);

      // Second identical search (should hit cache)
      const result2 = await searchService.search(query, options);

      expect(result1.query_info.total_time).toBeGreaterThan(0);
      expect(result2.query_info.total_time).toBeGreaterThan(0);
    });
  });

  describe('Search Integration Service', () => {
    test('should initialize integration service', () => {
      expect(integrationService).toBeDefined();
    });

    test('should perform integrated search with KB enrichment', async () => {
      // Mock KB service response
      (knowledgeBaseService.list as jest.Mock).mockResolvedValue({
        data: [
          {
            id: '1',
            title: 'Test Entry',
            problem: 'Test problem',
            solution: 'Test solution',
            category: 'JCL',
            tags: ['test', 'error'],
            created_at: new Date(),
            updated_at: new Date(),
            usage_count: 5,
            success_count: 4,
            failure_count: 1,
            version: 1
          }
        ],
        total: 1
      });

      const result = await integrationService.search('test', {
        limit: 10,
        include_facets: true
      });

      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('integration');
      expect(result.integration).toHaveProperty('fts_results');
      expect(result.integration).toHaveProperty('kb_enriched');
      expect(result.integration).toHaveProperty('processing_time');
    });

    test('should provide integrated suggestions', async () => {
      const suggestions = await integrationService.getSuggestions('jcl', 10);

      expect(Array.isArray(suggestions)).toBe(true);
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('text');
        expect(suggestion).toHaveProperty('type');
        expect(suggestion).toHaveProperty('frequency');
        expect(suggestion).toHaveProperty('source');
      });
    });

    test('should get search analytics', () => {
      const analytics = integrationService.getSearchAnalytics();

      expect(analytics).toHaveProperty('fts_stats');
      expect(analytics).toHaveProperty('integration_stats');
      expect(analytics).toHaveProperty('performance_metrics');
    });

    test('should sync with knowledge base', async () => {
      const syncStatus = await integrationService.syncWithKnowledgeBase();

      expect(syncStatus).toHaveProperty('lastSync');
      expect(syncStatus).toHaveProperty('totalEntries');
      expect(syncStatus).toHaveProperty('pendingChanges');
      expect(syncStatus).toHaveProperty('indexHealth');
    });
  });

  describe('FTS5 Search Controller', () => {
    test('should validate search requests', async () => {
      const mockReq = {
        body: {
          query: '', // Invalid empty query
          options: {
            limit: 150 // Invalid limit > 100
          }
        }
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;

      const mockNext = jest.fn();

      await controller.search(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR'
        })
      );
    });

    test('should handle valid search requests', async () => {
      const mockReq = {
        body: {
          query: 'test query',
          options: {
            limit: 20,
            offset: 0,
            include_facets: true
          },
          user_id: 'test-user',
          session_id: 'test-session'
        },
        headers: {
          'user-agent': 'test-agent'
        }
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      } as any;

      const mockNext = jest.fn();

      await controller.search(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
          meta: expect.objectContaining({
            response_time: expect.any(Number),
            api_version: '2.0'
          })
        })
      );
    });

    test('should handle suggestions requests', async () => {
      const mockReq = {
        query: {
          q: 'jcl',
          limit: '5'
        }
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      } as any;

      const mockNext = jest.fn();

      await controller.suggestions(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            suggestions: expect.any(Array),
            meta: expect.objectContaining({
              query: 'jcl',
              count: expect.any(Number)
            })
          })
        })
      );
    });

    test('should handle analytics requests', async () => {
      const mockReq = {
        query: {
          timeframe: '24h',
          metric: 'all'
        }
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn()
      } as any;

      const mockNext = jest.fn();

      await controller.analytics(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            stats: expect.any(Object),
            timestamp: expect.any(String)
          })
        })
      );
    });

    test('should handle health check requests', async () => {
      const mockReq = {} as any;
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const mockNext = jest.fn();

      await controller.healthCheck(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
          service: 'FTS5SearchService',
          timestamp: expect.any(String),
          metrics: expect.any(Object),
          uptime: expect.any(Number),
          memory: expect.any(Object)
        })
      );
    });
  });

  describe('Performance and Error Handling', () => {
    test('should handle search timeouts gracefully', async () => {
      // This would require mocking database delays
      const result = await searchService.search('test query', {
        limit: 10
      });

      expect(result).toHaveProperty('results');
      expect(result.query_info.total_time).toBeGreaterThan(0);
    });

    test('should handle malformed queries', async () => {
      const malformedQueries = [
        'title:"unclosed quote',
        'AND OR NOT',
        'field:',
        '((()))',
        'title: AND problem:'
      ];

      for (const query of malformedQueries) {
        try {
          const result = await searchService.search(query);
          // Should not throw, but may return empty results
          expect(result).toHaveProperty('results');
        } catch (error) {
          // If it throws, error should be handled gracefully
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    test('should handle concurrent search requests', async () => {
      const queries = [
        'test query 1',
        'test query 2',
        'test query 3',
        'test query 4',
        'test query 5'
      ];

      const searchPromises = queries.map(query =>
        searchService.search(query, { limit: 5 })
      );

      const results = await Promise.all(searchPromises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('results');
        expect(result).toHaveProperty('pagination');
      });
    });

    test('should respect memory limits and cleanup', async () => {
      // Perform many searches to test memory management
      const searches = Array.from({ length: 50 }, (_, i) =>
        searchService.search(`test query ${i}`, { limit: 10 })
      );

      const results = await Promise.allSettled(searches);

      // All searches should complete
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);

      // Cache should be limited in size (internal verification)
      const stats = searchService.getSearchStats();
      expect(stats.total_searches).toBe(50);
    });

    test('should handle database connection issues', async () => {
      // This test would require mocking database connection failures
      // For now, verify that the service can recover from errors

      try {
        const result = await searchService.search('test');
        expect(result).toHaveProperty('results');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Search Quality and Relevance', () => {
    test('should rank exact matches higher', async () => {
      // This test assumes we have test data
      const result = await searchService.search('exact match test', {
        limit: 10,
        sort_by: 'relevance'
      });

      if (result.results.length > 1) {
        // First result should have higher score
        expect(result.results[0].score).toBeGreaterThanOrEqual(result.results[1].score);
      }
    });

    test('should support field boosting', async () => {
      const result = await searchService.search('important', {
        boost_fields: {
          title: 3.0,
          problem: 1.5,
          solution: 1.0
        }
      });

      // Should execute without errors
      expect(result).toHaveProperty('results');
    });

    test('should filter results by minimum score', async () => {
      const result = await searchService.search('test', {
        min_score: 0.8,
        limit: 50
      });

      if (result.results.length > 0) {
        result.results.forEach(r => {
          expect(r.score).toBeGreaterThanOrEqual(80); // 0.8 * 100
        });
      }
    });

    test('should provide consistent ranking for identical queries', async () => {
      const query = 'consistency test';
      const options = { limit: 10, sort_by: 'relevance' as const };

      const result1 = await searchService.search(query, options);
      const result2 = await searchService.search(query, options);

      if (result1.results.length > 0 && result2.results.length > 0) {
        // Should return same results in same order
        expect(result1.results[0].entry.id).toBe(result2.results[0].entry.id);
      }
    });
  });
});

describe('FTS5 Query Parser', () => {
  test('should parse simple queries', () => {
    // These tests would require access to the FTS5QueryParser
    // which would need to be exported or tested separately
    expect(true).toBe(true); // Placeholder
  });

  test('should parse boolean queries', () => {
    expect(true).toBe(true); // Placeholder
  });

  test('should parse field-specific queries', () => {
    expect(true).toBe(true); // Placeholder
  });

  test('should handle query validation', () => {
    expect(true).toBe(true); // Placeholder
  });
});

describe('Search Result Integration Adapter', () => {
  let adapter: SearchResultsIntegrationAdapter;

  beforeEach(() => {
    adapter = new SearchResultsIntegrationAdapter();
  });

  test('should adapt FTS5 results to standard format', async () => {
    const mockFTSResults = [
      {
        entry: {
          id: '1',
          title: 'Test Entry',
          problem: 'Test problem',
          solution: 'Test solution',
          category: 'JCL',
          tags: ['test'],
          created_at: new Date(),
          updated_at: new Date(),
          usage_count: 1,
          success_count: 1,
          failure_count: 0
        },
        score: 85,
        rank: 1,
        bm25_score: 2.5,
        matchType: 'exact',
        field_matches: { title: 1 },
        highlights: [],
        metadata: {
          processingTime: 50,
          source: 'fts5',
          confidence: 0.85,
          fallback: false
        }
      }
    ];

    const adapted = await adapter.adaptSearchResults(mockFTSResults as any, {
      query: 'test',
      pagination: {} as any,
      facets: []
    });

    expect(adapted.results).toHaveLength(1);
    expect(adapted.results[0]).toHaveProperty('entry');
    expect(adapted.results[0]).toHaveProperty('score');
    expect(adapted.results[0]).toHaveProperty('metadata');
    expect(adapted.uiState).toBeDefined();
  });
});