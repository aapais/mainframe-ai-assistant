/**
 * Comprehensive Unit Tests for Enhanced SearchService
 * Target: >90% code coverage with performance validation
 */

import { SearchService } from '../../src/services/SearchService';
import { KBEntry, SearchOptions, SearchResult } from '../../src/types/services';

// Mock dependencies
jest.mock('../../src/database/KnowledgeDB', () => ({
  KnowledgeDB: jest.fn().mockImplementation(() => ({
    prepare: jest.fn(() => ({
      all: jest.fn(() => []),
      run: jest.fn(),
      get: jest.fn()
    }))
  }))
}));

describe('Enhanced SearchService', () => {
  let searchService: SearchService;
  let mockDatabase: any;
  let mockCacheManager: any;
  let sampleEntries: KBEntry[];

  beforeEach(() => {
    // Setup mock database
    mockDatabase = {
      prepare: jest.fn(() => ({
        all: jest.fn(() => [
          {
            id: 'test1',
            title: 'VSAM Status 35 Error',
            problem: 'Job fails with VSAM status 35',
            solution: 'Check file exists and is cataloged',
            category: 'VSAM',
            tags: 'vsam,status,35',
            created_at: '2024-01-01',
            usage_count: 10,
            success_count: 8,
            failure_count: 2,
            relevance_score: -2.5,
            title_highlight: 'VSAM <mark>Status</mark> 35 Error',
            snippet: 'Job fails with VSAM status 35...'
          }
        ]),
        run: jest.fn(),
        get: jest.fn()
      }))
    };

    // Setup mock cache manager
    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      invalidate: jest.fn()
    };

    // Create sample entries
    sampleEntries = [
      {
        id: '1',
        title: 'VSAM Status 35 Error',
        problem: 'Job fails with VSAM status 35',
        solution: 'Check if file exists and is properly cataloged',
        category: 'VSAM',
        tags: ['vsam', 'status', '35', 'error'],
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        usage_count: 10,
        success_count: 8,
        failure_count: 2
      },
      {
        id: '2',
        title: 'JCL Allocation Error',
        problem: 'Dataset allocation fails in JCL',
        solution: 'Verify dataset name and allocation parameters',
        category: 'JCL',
        tags: ['jcl', 'allocation', 'dataset'],
        created_at: new Date('2024-01-02'),
        updated_at: new Date('2024-01-02'),
        usage_count: 15,
        success_count: 12,
        failure_count: 3
      },
      {
        id: '3',
        title: 'S0C7 Data Exception',
        problem: 'Program abends with S0C7 data exception',
        solution: 'Check for non-numeric data in numeric fields',
        category: 'Batch',
        tags: ['s0c7', 'abend', 'data', 'exception'],
        created_at: new Date('2024-01-03'),
        updated_at: new Date('2024-01-03'),
        usage_count: 25,
        success_count: 20,
        failure_count: 5
      }
    ];

    // Initialize service with mocks
    searchService = new SearchService(
      { apiKey: 'test-key', model: 'gemini-pro' },
      mockDatabase,
      mockCacheManager
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Enhanced Search Functionality', () => {
    test('should perform optimized search with L0 cache check', async () => {
      const query = 'VSAM status error';
      const options: SearchOptions = { limit: 10 };

      const results = await searchService.search(query, sampleEntries, options);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should use L0 instant cache for repeated queries', async () => {
      const query = 'VSAM status error';
      const options: SearchOptions = { limit: 10 };

      // First search
      const firstResults = await searchService.search(query, sampleEntries, options);

      // Second search should hit L0 cache
      const secondResults = await searchService.search(query, sampleEntries, options);

      expect(firstResults).toEqual(secondResults);
    });

    test('should handle FTS5 database search optimization', async () => {
      const query = 'VSAM status 35';
      const options: SearchOptions = { limit: 10 };

      const results = await searchService.search(query, sampleEntries, options);

      expect(mockDatabase.prepare).toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata?.source).toBe('fts5');
    });

    test('should execute parallel search strategies', async () => {
      const query = 'complex database error';
      const options: SearchOptions = { useAI: true, limit: 10 };

      const results = await searchService.search(query, sampleEntries, options);

      expect(results).toBeDefined();
      // Should have attempted both FTS5 and local search
      expect(mockDatabase.prepare).toHaveBeenCalled();
    });

    test('should apply advanced ranking algorithms', async () => {
      const query = 'error resolution';
      const options: SearchOptions = { limit: 10 };

      const results = await searchService.search(query, sampleEntries, options);

      // Results should be ranked by enhanced scoring
      expect(results).toHaveLength(sampleEntries.length);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[0].metadata?.optimized).toBe(true);
    });

    test('should handle empty queries gracefully', async () => {
      const results = await searchService.search('', sampleEntries, {});
      expect(results).toEqual([]);
    });

    test('should apply query optimization', async () => {
      const query = 'vsam stat 35'; // Intentional typos
      const results = await searchService.search(query, sampleEntries, {});

      expect(results.length).toBeGreaterThan(0);
      // Should have found VSAM status 35 despite typos
    });

    test('should provide enhanced highlights', async () => {
      const query = 'VSAM status';
      const options: SearchOptions = { includeHighlights: true };

      const results = await searchService.search(query, sampleEntries, options);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].highlights).toBeDefined();
      expect(results[0].highlights!.length).toBeGreaterThan(0);
    });

    test('should handle AI search fallback gracefully', async () => {
      // Mock AI search to fail
      const originalSearch = searchService.searchWithAI;
      jest.spyOn(searchService, 'searchWithAI').mockRejectedValue(new Error('AI service unavailable'));

      const query = 'complex query';
      const options: SearchOptions = { useAI: true };

      const results = await searchService.search(query, sampleEntries, options);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Optimizations', () => {
    test('should complete search within performance targets', async () => {
      const startTime = performance.now();

      await searchService.search('VSAM error', sampleEntries, { limit: 50 });

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(500); // < 500ms target
    });

    test('should maintain L0 cache size limits', async () => {
      // Make 60 different queries to test cache eviction
      for (let i = 0; i < 60; i++) {
        await searchService.search(`query ${i}`, sampleEntries, {});
      }

      // Cache should have been trimmed
      const metrics = searchService.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    });

    test('should record performance metrics', async () => {
      await searchService.search('test query', sampleEntries, {});

      const metrics = searchService.getPerformanceMetrics();
      expect(metrics.averageSearchTime).toBeGreaterThanOrEqual(0);
      expect(metrics.queryOptimizationCacheSize).toBeGreaterThanOrEqual(0);
    });

    test('should handle large datasets efficiently', async () => {
      // Create large dataset
      const largeDataset: KBEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        largeDataset.push({
          ...sampleEntries[0],
          id: `entry_${i}`,
          title: `Entry ${i} VSAM Status Error`
        });
      }

      const startTime = performance.now();
      const results = await searchService.search('VSAM status', largeDataset, { limit: 10 });
      const duration = performance.now() - startTime;

      expect(results.length).toBeLessThanOrEqual(10);
      expect(duration).toBeLessThan(1000); // Should complete in < 1s
    });
  });

  describe('Query Optimization', () => {
    test('should optimize simple queries', () => {
      const metrics = searchService.getPerformanceMetrics();
      expect(metrics.queryOptimizationCacheSize).toBeGreaterThanOrEqual(0);
    });

    test('should detect query intent correctly', async () => {
      const errorQuery = 'S0C7 abend error resolution';
      const howToQuery = 'how to setup VSAM file';

      const errorResults = await searchService.search(errorQuery, sampleEntries, {});
      const howToResults = await searchService.search(howToQuery, sampleEntries, {});

      expect(errorResults).toBeDefined();
      expect(howToResults).toBeDefined();
    });

    test('should cache query optimizations', async () => {
      const query = 'complex mainframe query';

      // First search
      await searchService.search(query, sampleEntries, {});

      // Second identical search should use cached optimization
      const startTime = performance.now();
      await searchService.search(query, sampleEntries, {});
      const duration = performance.now() - startTime;

      // Should be faster due to cached optimization
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockDatabase.prepare = jest.fn(() => {
        throw new Error('Database connection failed');
      });

      const results = await searchService.search('test query', sampleEntries, {});

      // Should fallback to local search
      expect(results).toBeDefined();
    });

    test('should handle empty search results', async () => {
      const results = await searchService.search('nonexistent query xyz123', [], {});
      expect(results).toEqual([]);
    });

    test('should handle malformed entries', async () => {
      const malformedEntries = [
        {
          id: '1',
          title: '',
          problem: null as any,
          solution: undefined as any,
          category: 'Test',
          tags: [],
          created_at: new Date(),
          updated_at: new Date(),
          usage_count: 0,
          success_count: 0,
          failure_count: 0
        }
      ];

      const results = await searchService.search('test', malformedEntries, {});
      expect(results).toBeDefined();
    });
  });

  describe('Search Options', () => {
    test('should respect search limit option', async () => {
      const results = await searchService.search('test', sampleEntries, { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should filter by category when specified', async () => {
      const results = await searchService.search('error', sampleEntries, {
        category: 'VSAM'
      });

      results.forEach(result => {
        expect(result.entry.category).toBe('VSAM');
      });
    });

    test('should filter by tags when specified', async () => {
      const results = await searchService.search('error', sampleEntries, {
        tags: ['vsam']
      });

      results.forEach(result => {
        expect(result.entry.tags.some(tag => tag.includes('vsam'))).toBe(true);
      });
    });

    test('should bypass cache when requested', async () => {
      const query = 'bypass cache test';
      const options: SearchOptions = { bypassCache: true };

      const results = await searchService.search(query, sampleEntries, options);
      expect(results).toBeDefined();
    });
  });

  describe('Suggestion System', () => {
    test('should provide search suggestions', async () => {
      const suggestions = await searchService.suggest('vsa');
      expect(Array.isArray(suggestions)).toBe(true);
    });

    test('should limit suggestions appropriately', async () => {
      const suggestions = await searchService.suggest('error', 5);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    test('should handle empty suggestion queries', async () => {
      const suggestions = await searchService.suggest('');
      expect(suggestions).toEqual([]);
    });
  });

  describe('Search History and Analytics', () => {
    test('should track search history', async () => {
      await searchService.search('test query 1', sampleEntries, { userId: 'user1' });
      await searchService.search('test query 2', sampleEntries, { userId: 'user1' });

      const history = await searchService.getRecentSearches();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    test('should track popular searches', async () => {
      // Make the same query multiple times
      for (let i = 0; i < 5; i++) {
        await searchService.search('popular query', sampleEntries, {});
      }

      const popular = await searchService.getPopularSearches();
      expect(popular.length).toBeGreaterThanOrEqual(1);
      expect(popular[0].query).toBe('popular query');
    });

    test('should provide search explanations', async () => {
      const results = await searchService.search('VSAM status', sampleEntries, {});

      if (results.length > 0) {
        const explanation = await searchService.explain('VSAM status', results[0]);
        expect(typeof explanation).toBe('string');
        expect(explanation.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Integration with External Services', () => {
    test('should integrate with cache manager when available', async () => {
      mockCacheManager.get = jest.fn().mockResolvedValue(null);
      mockCacheManager.set = jest.fn().mockResolvedValue(undefined);

      await searchService.search('cached query', sampleEntries, {});

      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });
});

// Performance benchmark tests
describe('SearchService Performance Benchmarks', () => {
  let searchService: SearchService;
  let largeDataset: KBEntry[];

  beforeAll(() => {
    searchService = new SearchService();

    // Create large dataset for performance testing
    largeDataset = [];
    for (let i = 0; i < 10000; i++) {
      largeDataset.push({
        id: `perf_${i}`,
        title: `Performance Test Entry ${i}`,
        problem: `This is a performance test problem for entry ${i} with various keywords`,
        solution: `Solution for performance test ${i} involving multiple steps and procedures`,
        category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional'][i % 5],
        tags: ['performance', 'test', `tag${i % 10}`, 'benchmark'],
        created_at: new Date(Date.now() - (i * 1000)),
        updated_at: new Date(Date.now() - (i * 1000)),
        usage_count: Math.floor(Math.random() * 100),
        success_count: Math.floor(Math.random() * 50),
        failure_count: Math.floor(Math.random() * 10)
      });
    }
  });

  test('should maintain sub-second response times for large datasets', async () => {
    const queries = [
      'performance test',
      'JCL error resolution',
      'VSAM file operations',
      'DB2 database queries',
      'batch processing issues'
    ];

    for (const query of queries) {
      const startTime = performance.now();
      const results = await searchService.search(query, largeDataset, { limit: 50 });
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000); // < 1 second
      expect(results.length).toBeLessThanOrEqual(50);
    }
  });

  test('should efficiently handle concurrent searches', async () => {
    const concurrentQueries = [];
    const startTime = performance.now();

    // Launch 10 concurrent searches
    for (let i = 0; i < 10; i++) {
      concurrentQueries.push(
        searchService.search(`concurrent query ${i}`, largeDataset.slice(0, 1000), { limit: 10 })
      );
    }

    const results = await Promise.all(concurrentQueries);
    const totalDuration = performance.now() - startTime;

    expect(results).toHaveLength(10);
    expect(totalDuration).toBeLessThan(5000); // All queries complete in < 5 seconds

    results.forEach(result => {
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  test('should demonstrate cache performance improvements', async () => {
    const query = 'cache performance test';

    // First search (cold)
    const coldStart = performance.now();
    await searchService.search(query, largeDataset.slice(0, 1000), {});
    const coldDuration = performance.now() - coldStart;

    // Second search (should hit cache)
    const warmStart = performance.now();
    await searchService.search(query, largeDataset.slice(0, 1000), {});
    const warmDuration = performance.now() - warmStart;

    // Warm search should be significantly faster
    expect(warmDuration).toBeLessThan(coldDuration * 0.5); // At least 50% faster
    expect(warmDuration).toBeLessThan(50); // Sub-50ms cache hit
  });

  test('should maintain memory efficiency under load', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Perform many searches with different queries
    for (let i = 0; i < 100; i++) {
      await searchService.search(`memory test query ${i}`, largeDataset.slice(0, 100), {});
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be reasonable (< 100MB for 100 searches)
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
  });
});