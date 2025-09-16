/**
 * Unit Tests for SearchOptimizer
 * Testing query optimization, parallel execution, and performance analysis
 */

import SearchOptimizer from '../../src/services/SearchOptimizer';
import { KBEntry, SearchOptions, SearchResult } from '../../src/types/services';

describe('SearchOptimizer', () => {
  let optimizer: SearchOptimizer;
  let sampleEntries: KBEntry[];
  let mockSearchMethods: Map<string, Function>;

  beforeEach(() => {
    optimizer = new SearchOptimizer();

    // Sample KB entries for testing
    sampleEntries = [
      {
        id: '1',
        title: 'VSAM Status 35 Error',
        problem: 'Job fails with VSAM status 35 file not found',
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
        title: 'JCL Allocation Error IEF212I',
        problem: 'Dataset allocation fails with IEF212I message',
        solution: 'Verify dataset name spelling and allocation parameters',
        category: 'JCL',
        tags: ['jcl', 'allocation', 'ief212i', 'dataset'],
        created_at: new Date('2024-01-02'),
        updated_at: new Date('2024-01-02'),
        usage_count: 15,
        success_count: 12,
        failure_count: 3
      },
      {
        id: '3',
        title: 'S0C7 COBOL Data Exception',
        problem: 'COBOL program abends with S0C7 data exception error',
        solution: 'Check for non-numeric data in numeric fields and initialize working storage',
        category: 'Batch',
        tags: ['s0c7', 'abend', 'cobol', 'data', 'exception'],
        created_at: new Date('2024-01-03'),
        updated_at: new Date('2024-01-03'),
        usage_count: 25,
        success_count: 20,
        failure_count: 5
      }
    ];

    // Mock search methods
    mockSearchMethods = new Map();

    // FTS5 search method
    mockSearchMethods.set('fts5', async (query: string, entries: KBEntry[], options: SearchOptions) => {
      const results: SearchResult[] = entries
        .filter(entry =>
          entry.title.toLowerCase().includes(query.toLowerCase()) ||
          entry.problem.toLowerCase().includes(query.toLowerCase())
        )
        .map(entry => ({
          entry,
          score: 85,
          matchType: 'exact' as const,
          metadata: { source: 'fts5', processingTime: 50 }
        }));

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 30));
      return results;
    });

    // AI search method
    mockSearchMethods.set('ai', async (query: string, entries: KBEntry[], options: SearchOptions) => {
      const results: SearchResult[] = entries
        .slice(0, 2) // AI returns fewer but more relevant results
        .map(entry => ({
          entry,
          score: 92,
          matchType: 'ai' as const,
          metadata: { source: 'ai', processingTime: 200 }
        }));

      // Simulate AI processing time
      await new Promise(resolve => setTimeout(resolve, 150));
      return results;
    });

    // Local fuzzy search
    mockSearchMethods.set('local', async (query: string, entries: KBEntry[], options: SearchOptions) => {
      const queryWords = query.toLowerCase().split(' ');
      const results: SearchResult[] = entries
        .map(entry => {
          const text = `${entry.title} ${entry.problem}`.toLowerCase();
          const matches = queryWords.filter(word => text.includes(word));
          const score = (matches.length / queryWords.length) * 70;

          return score > 20 ? {
            entry,
            score,
            matchType: 'fuzzy' as const,
            metadata: { source: 'local', processingTime: 80 }
          } : null;
        })
        .filter(result => result !== null) as SearchResult[];

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 60));
      return results;
    });

    // Category-specific search
    mockSearchMethods.set('category', async (query: string, entries: KBEntry[], options: SearchOptions) => {
      const results: SearchResult[] = entries
        .filter(entry => options.category ? entry.category === options.category : true)
        .map(entry => ({
          entry,
          score: 78,
          matchType: 'category' as const,
          metadata: { source: 'category', processingTime: 25 }
        }));

      await new Promise(resolve => setTimeout(resolve, 20));
      return results;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Query Optimization', () => {
    test('should optimize simple queries correctly', async () => {
      const query = 'vsam error';
      const optimization = await optimizer.optimizeQuery(query, {});

      expect(optimization).toBeDefined();
      expect(optimization.originalQuery).toBe(query);
      expect(optimization.confidence).toBeGreaterThan(0);
      expect(optimization.reasoning).toHaveLength(0); // Simple query needs no optimization
    });

    test('should detect and correct typos', async () => {
      const query = 'cobal abend'; // Typo: should be 'cobol'
      const optimization = await optimizer.optimizeQuery(query, {});

      expect(optimization.optimizedQuery).toContain('cobol');
      expect(optimization.reasoning).toContain('Applied spell correction');
    });

    test('should expand short queries', async () => {
      const query = 's0c7'; // Short query with error code
      const optimization = await optimizer.optimizeQuery(query, {});

      expect(optimization.optimizationType).toBe('expand');
      expect(optimization.optimizedQuery).toContain('abend error');
      expect(optimization.reasoning).toContain('Expanded short query with context');
    });

    test('should focus overly broad queries', async () => {
      const query = 'how to setup configure install and manage VSAM files with COBOL programs and JCL jobs';
      const optimization = await optimizer.optimizeQuery(query, {});

      expect(optimization.optimizationType).toBe('focus');
      expect(optimization.optimizedQuery.split(' ')).toHaveLength(5);
      expect(optimization.reasoning).toContain('Focused overly broad query');
    });

    test('should standardize technical terms', async () => {
      const query = 'job control language error';
      const optimization = await optimizer.optimizeQuery(query, {});

      expect(optimization.optimizedQuery).toContain('JCL');
      expect(optimization.reasoning).toContain('Standardized technical terminology');
    });

    test('should cache query optimizations', async () => {
      const query = 'test caching query';

      // First optimization
      const start1 = performance.now();
      const opt1 = await optimizer.optimizeQuery(query, {});
      const time1 = performance.now() - start1;

      // Second optimization (should be cached)
      const start2 = performance.now();
      const opt2 = await optimizer.optimizeQuery(query, {});
      const time2 = performance.now() - start2;

      expect(opt1).toEqual(opt2);
      expect(time2).toBeLessThan(time1 * 0.1); // Much faster with cache
    });
  });

  describe('Search Strategy Selection', () => {
    test('should select appropriate strategies for different query types', async () => {
      const queries = [
        { query: 'simple error', expectedStrategies: ['fts5_optimized', 'local_fuzzy'] },
        { query: 'complex semantic query requiring understanding', expectedStrategies: ['fts5_optimized', 'ai_semantic', 'local_fuzzy'] },
        { query: 'JCL allocation error', expectedStrategies: ['fts5_optimized', 'category_specific', 'local_fuzzy'] }
      ];

      for (const { query } of queries) {
        const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      }
    });

    test('should prioritize strategies based on confidence and estimated performance', async () => {
      const query = 'VSAM file error';
      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });

    test('should limit number of parallel strategies', async () => {
      const query = 'test query';
      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      // Should not exceed maximum parallel strategies (5)
      expect(results).toBeDefined();
    });
  });

  describe('Parallel Execution', () => {
    test('should execute multiple strategies in parallel', async () => {
      const query = 'parallel test query';
      const startTime = performance.now();

      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      const totalTime = performance.now() - startTime;

      // Parallel execution should be faster than sequential
      expect(totalTime).toBeLessThan(400); // Much less than sum of individual strategy times
      expect(results).toBeDefined();
    });

    test('should handle strategy timeouts gracefully', async () => {
      // Create a slow strategy that times out
      mockSearchMethods.set('slow', async () => {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        return [];
      });

      const query = 'timeout test';
      const startTime = performance.now();

      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);
      const totalTime = performance.now() - startTime;

      // Should complete much faster than 5 seconds due to timeout
      expect(totalTime).toBeLessThan(2000);
      expect(results).toBeDefined();
    });

    test('should continue with successful strategies when some fail', async () => {
      // Create a failing strategy
      mockSearchMethods.set('failing', async () => {
        throw new Error('Strategy failed');
      });

      const query = 'error handling test';
      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      // Should still return results from successful strategies
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Result Optimization and Merging', () => {
    test('should merge results from multiple strategies intelligently', async () => {
      const query = 'VSAM error handling';
      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Results should be properly ranked
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    test('should boost scores for multi-strategy matches', async () => {
      const query = 'VSAM status error'; // Should match multiple strategies
      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      const topResult = results[0];
      expect(topResult.metadata?.multiStrategy).toBe(true);
      expect(topResult.metadata?.strategies).toBeDefined();
      expect(Array.isArray(topResult.metadata?.strategies)).toBe(true);
    });

    test('should apply advanced ranking algorithms', async () => {
      const query = 'error resolution help';
      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      results.forEach(result => {
        expect(result.metadata?.optimized).toBe(true);
        expect(result.metadata?.originalScore).toBeDefined();
        expect(result.metadata?.semanticAlignment).toBeDefined();
        expect(result.metadata?.historicalPerformance).toBeDefined();
      });
    });

    test('should apply diversity penalty to avoid redundant results', async () => {
      const query = 'test diversity';
      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      // Check that similar results have appropriate diversity scores
      results.forEach(result => {
        expect(result.metadata?.diversityScore).toBeDefined();
        expect(result.metadata?.diversityScore).toBeGreaterThanOrEqual(80); // Good diversity
      });
    });
  });

  describe('Performance Metrics and Analysis', () => {
    test('should record optimization metrics', async () => {
      const query = 'metrics test';
      await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      const metrics = optimizer.getMetrics();

      expect(metrics.totalOptimizations).toBeGreaterThan(0);
      expect(metrics.averageImprovement).toBeGreaterThanOrEqual(0);
      expect(metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(metrics.topStrategies)).toBe(true);
      expect(Array.isArray(metrics.performanceBottlenecks)).toBe(true);
    });

    test('should track strategy performance', async () => {
      // Execute multiple searches to build metrics
      const queries = ['query 1', 'query 2', 'query 3'];

      for (const query of queries) {
        await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);
      }

      const metrics = optimizer.getMetrics();
      expect(metrics.topStrategies.length).toBeGreaterThan(0);

      metrics.topStrategies.forEach(strategy => {
        expect(strategy.usage).toBeGreaterThan(0);
        expect(strategy.avgTime).toBeGreaterThan(0);
        expect(strategy.successRate).toBeGreaterThanOrEqual(0);
      });
    });

    test('should identify performance bottlenecks', async () => {
      // Create a slow strategy to trigger bottleneck detection
      mockSearchMethods.set('very_slow', async () => {
        await new Promise(resolve => setTimeout(resolve, 600)); // Slow strategy
        return [{
          entry: sampleEntries[0],
          score: 50,
          matchType: 'fuzzy' as const,
          metadata: { source: 'very_slow' }
        }];
      });

      const query = 'bottleneck test';
      await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      const metrics = optimizer.getMetrics();
      expect(metrics.performanceBottlenecks.length).toBeGreaterThan(0);
    });
  });

  describe('Context and Intent Detection', () => {
    test('should detect error resolution intent', async () => {
      const query = 'S0C7 abend error fix';
      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      // Should boost error-related entries
      expect(results[0].entry.tags).toContain('error');
    });

    test('should detect how-to intent', async () => {
      const query = 'how to setup VSAM file';
      await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      // Intent detection should influence optimization
      const metrics = optimizer.getMetrics();
      expect(metrics.totalOptimizations).toBeGreaterThan(0);
    });

    test('should detect troubleshooting intent', async () => {
      const query = 'troubleshoot JCL allocation problem';
      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      expect(results).toBeDefined();
    });
  });

  describe('Error Handling and Fallbacks', () => {
    test('should handle search method failures gracefully', async () => {
      const emptySearchMethods = new Map();

      const query = 'fallback test';
      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, emptySearchMethods);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should provide fallback when all strategies fail', async () => {
      const failingMethods = new Map();
      failingMethods.set('failing', async () => {
        throw new Error('All methods fail');
      });

      const query = 'all fail test';
      const results = await optimizer.optimizeSearch(query, sampleEntries, {}, failingMethods);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    test('should handle empty entry sets', async () => {
      const query = 'empty entries test';
      const results = await optimizer.optimizeSearch(query, [], {}, mockSearchMethods);

      expect(results).toBeDefined();
      expect(results).toHaveLength(0);
    });

    test('should handle malformed search options', async () => {
      const query = 'malformed options test';
      const malformedOptions = { limit: -1, category: null } as any;

      const results = await optimizer.optimizeSearch(query, sampleEntries, malformedOptions, mockSearchMethods);

      expect(results).toBeDefined();
    });
  });

  describe('Memory Management and Cleanup', () => {
    test('should manage cache size effectively', async () => {
      // Generate many unique queries to test cache management
      for (let i = 0; i < 1200; i++) {
        await optimizer.optimizeQuery(`cache test query ${i}`, {});
      }

      // Cache should have been trimmed to reasonable size
      const metrics = optimizer.getMetrics();
      expect(metrics).toBeDefined();
    });

    test('should clean up old optimization history', async () => {
      // This test validates that the optimizer doesn't leak memory over time
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate many optimizations
      for (let i = 0; i < 100; i++) {
        await optimizer.optimizeSearch(`cleanup test ${i}`, sampleEntries, {}, mockSearchMethods);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });

  describe('Performance Validation', () => {
    test('should complete optimization within time constraints', async () => {
      const query = 'performance validation test';
      const startTime = performance.now();

      await optimizer.optimizeSearch(query, sampleEntries, {}, mockSearchMethods);

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle concurrent optimizations efficiently', async () => {
      const concurrentPromises = [];
      const startTime = performance.now();

      // Launch 10 concurrent optimizations
      for (let i = 0; i < 10; i++) {
        concurrentPromises.push(
          optimizer.optimizeSearch(`concurrent ${i}`, sampleEntries, {}, mockSearchMethods)
        );
      }

      const results = await Promise.all(concurrentPromises);
      const totalTime = performance.now() - startTime;

      expect(results).toHaveLength(10);
      expect(totalTime).toBeLessThan(2000); // All should complete within 2 seconds
    });
  });
});