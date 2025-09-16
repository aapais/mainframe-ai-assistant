import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { GeminiService } from '../../src/services/GeminiService';
import { SearchService } from '../../src/services/SearchService';
import { PerformanceTestHelper } from '../../src/database/__tests__/test-utils/PerformanceTestHelper';
import { TestDatabaseFactory } from '../../src/database/__tests__/test-utils/TestDatabaseFactory';
import path from 'path';
import fs from 'fs';

describe('Search Performance Validation Tests', () => {
  let dbManager: DatabaseManager;
  let kb: KnowledgeDB;
  let searchService: SearchService;
  let geminiService: GeminiService;
  let performanceHelper: PerformanceTestHelper;
  let testDbPath: string;

  beforeAll(() => {
    performanceHelper = new PerformanceTestHelper();
    testDbPath = path.join(__dirname, '..', 'temp', 'search-performance-test.db');
  });

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    dbManager = await TestDatabaseFactory.createTestDatabaseManager({
      path: testDbPath,
      enableWAL: true,
      cacheSize: 100, // MB
      maxConnections: 10,
      queryCache: {
        enabled: true,
        maxSize: 1000,
        ttlMs: 300000 // 5 minutes
      }
    });

    kb = new KnowledgeDB(testDbPath);
    
    // Mock Gemini service for testing
    geminiService = {
      searchSimilar: jest.fn(),
      explainCode: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true)
    } as any;

    searchService = new SearchService(kb, geminiService);

    // Populate with test data
    await this.setupTestData();
  });

  afterEach(async () => {
    if (kb) {
      kb.close();
    }
    if (dbManager) {
      await dbManager.shutdown();
    }
  });

  afterAll(() => {
    performanceHelper.clearResults();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  async setupTestData(): Promise<void> {
    const entries = TestDatabaseFactory.createLargeTestDataset(1000);
    
    await dbManager.transaction(async () => {
      for (const entry of entries) {
        await kb.addEntry(entry, 'test-user');
      }
    });
  }

  describe('MVP1 Requirement: Local Search < 1s for 1000 entries', () => {
    it('should complete local full-text search within 1 second', async () => {
      const searchQueries = [
        'VSAM status error',
        'data exception COBOL',
        'JCL dataset not found',
        'DB2 resource unavailable',
        'system abend S0C7',
        'file allocation error',
        'batch job failed',
        'connection timeout',
        'memory violation',
        'invalid parameter'
      ];

      const results = await performanceHelper.compareImplementations(
        searchQueries.map(query => ({
          name: `local-search-${query.replace(/\s+/g, '-')}`,
          fn: () => kb.search(query, { useAI: false, limit: 20 })
        })),
        10 // 10 iterations per query
      );

      Object.values(results).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.executionTime / result.iterations).toBeLessThan(1000); // < 1s per search
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(1);
      });

      // Verify average search time across all queries
      const avgTime = Object.values(results)
        .reduce((sum, r) => sum + (r.metrics.executionTime / r.iterations), 0) / Object.keys(results).length;
      
      expect(avgTime).toBeLessThan(500); // Average should be well under 1s
    });

    it('should maintain performance with complex search patterns', async () => {
      const complexQueries = [
        'VSAM AND status AND (35 OR 37)',
        '"data exception" OR "protection exception"',
        'JCL +dataset -temporary',
        'error category:VSAM',
        'abend tag:critical',
        'timeout NOT connection',
        'system failure severity:high',
        'memory (allocation OR violation)',
        'file (open OR close) error',
        '(batch OR online) job failed'
      ];

      const results = await performanceHelper.compareImplementations(
        complexQueries.map(query => ({
          name: `complex-search-${query.substring(0, 15).replace(/\s+/g, '-')}`,
          fn: () => kb.search(query, { useAI: false, limit: 50 })
        })),
        5
      );

      Object.values(results).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.executionTime / result.iterations).toBeLessThan(1500); // Allow slightly more for complex queries
      });
    });

    it('should scale efficiently with dataset growth', async () => {
      const sizes = [500, 1000, 1500, 2000];
      const scalingResults: any[] = [];

      for (const targetSize of sizes) {
        const currentSize = await kb.getEntryCount();
        
        if (currentSize < targetSize) {
          const additionalEntries = TestDatabaseFactory.createLargeTestDataset(targetSize - currentSize);
          await dbManager.transaction(async () => {
            for (const entry of additionalEntries) {
              await kb.addEntry(entry, 'test-user');
            }
          });
        }

        const searchResult = await performanceHelper.measureOperation(
          `scaling-search-${targetSize}`,
          () => kb.search('system error data', { useAI: false, limit: 20 }),
          10
        );

        scalingResults.push({
          size: targetSize,
          avgTime: searchResult.metrics.executionTime / searchResult.iterations,
          opsPerSec: searchResult.metrics.operationsPerSecond
        });
      }

      // Performance should not degrade linearly with data growth
      const firstResult = scalingResults[0];
      const lastResult = scalingResults[scalingResults.length - 1];
      
      // 4x data should not cause more than 2x time increase (logarithmic scaling)
      expect(lastResult.avgTime).toBeLessThan(firstResult.avgTime * 2);
      
      // Should still meet the 1s requirement even with larger datasets
      expect(lastResult.avgTime).toBeLessThan(1000);
    });
  });

  describe('MVP1 Requirement: Gemini API Search < 2s with fallback', () => {
    it('should complete AI-enhanced search within 2 seconds when API available', async () => {
      // Mock successful Gemini API response
      (geminiService.searchSimilar as jest.Mock).mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve([
            { score: 0.95, entry: { id: '1', title: 'Test Entry' } },
            { score: 0.87, entry: { id: '2', title: 'Another Entry' } }
          ]), 800); // Simulate 800ms API response
        })
      );

      const aiQueries = [
        'application crashes unexpectedly',
        'performance degradation issues',
        'data corruption problems',
        'network connectivity failures',
        'authentication problems'
      ];

      const results = await performanceHelper.compareImplementations(
        aiQueries.map(query => ({
          name: `ai-search-${query.split(' ')[0]}`,
          fn: () => searchService.search(query, { useAI: true, limit: 10 })
        })),
        5
      );

      Object.values(results).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.executionTime / result.iterations).toBeLessThan(2000); // < 2s per search
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(0.5);
      });
    });

    it('should fallback gracefully when AI API fails', async () => {
      // Mock failed Gemini API response
      (geminiService.searchSimilar as jest.Mock).mockImplementation(
        () => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('API timeout')), 5000);
        })
      );

      const fallbackResult = await performanceHelper.measureOperation(
        'ai-fallback-search',
        () => searchService.search('VSAM error handling', { useAI: true, limit: 10 }),
        5
      );

      expect(fallbackResult.success).toBe(true);
      // Should fallback to local search and complete within 1s
      expect(fallbackResult.metrics.executionTime / fallbackResult.iterations).toBeLessThan(1000);
    });

    it('should handle concurrent AI requests efficiently', async () => {
      // Mock Gemini API with realistic delay
      (geminiService.searchSimilar as jest.Mock).mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve([
            { score: 0.90, entry: { id: '1', title: 'Concurrent Test Entry' } }
          ]), 600 + Math.random() * 400); // 600-1000ms delay
        })
      );

      const concurrentOperations = Array(10).fill(0).map((_, i) => 
        () => searchService.search(`concurrent query ${i}`, { useAI: true, limit: 5 })
      );

      const concurrentResult = await performanceHelper.runLoadTest({
        concurrentUsers: 5,
        duration: 10, // 10 seconds
        rampUpTime: 2, // 2 seconds ramp-up
        operations: concurrentOperations
      });

      const successRate = concurrentResult.filter(r => r.success).length / concurrentResult.length;
      expect(successRate).toBeGreaterThan(0.9); // 90% success rate

      // Average response time should still be reasonable
      const avgTime = concurrentResult
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.metrics.executionTime, 0) / concurrentResult.filter(r => r.success).length;
      
      expect(avgTime).toBeLessThan(3000); // Allow slightly more time under concurrent load
    });
  });

  describe('FTS5 Optimization Validation', () => {
    it('should demonstrate FTS5 performance advantages', async () => {
      // Create a table without FTS5 for comparison
      await dbManager.execute(`
        CREATE TEMP TABLE kb_entries_no_fts AS 
        SELECT * FROM kb_entries
      `);

      const testQuery = 'system error data processing';
      
      // Test FTS5 search
      const ftsResult = await performanceHelper.measureOperation(
        'fts5-search',
        () => dbManager.execute(`
          SELECT * FROM kb_fts 
          WHERE kb_fts MATCH ? 
          ORDER BY bm25(kb_fts) 
          LIMIT 20
        `, [testQuery]),
        50
      );

      // Test LIKE search on regular table
      const likeResult = await performanceHelper.measureOperation(
        'like-search',
        () => dbManager.execute(`
          SELECT * FROM kb_entries_no_fts 
          WHERE title LIKE ? OR problem LIKE ? OR solution LIKE ?
          LIMIT 20
        `, [`%${testQuery}%`, `%${testQuery}%`, `%${testQuery}%`]),
        50
      );

      expect(ftsResult.success).toBe(true);
      expect(likeResult.success).toBe(true);
      
      // FTS5 should be significantly faster
      expect(ftsResult.metrics.operationsPerSecond).toBeGreaterThan(likeResult.metrics.operationsPerSecond! * 2);
    });

    it('should optimize phrase queries effectively', async () => {
      const phraseQueries = [
        '"data exception"',
        '"file not found"',
        '"system abend"',
        '"connection timeout"',
        '"memory violation"'
      ];

      const phraseResults = await performanceHelper.compareImplementations(
        phraseQueries.map(query => ({
          name: `phrase-${query.replace(/[^a-zA-Z0-9]/g, '-')}`,
          fn: () => kb.search(query, { useAI: false, limit: 10 })
        })),
        20
      );

      Object.values(phraseResults).forEach(result => {
        expect(result.success).toBe(true);
        expect(result.metrics.operationsPerSecond).toBeGreaterThan(50);
      });
    });

    it('should handle ranking and relevance efficiently', async () => {
      const rankingQuery = 'VSAM error status';
      
      const rankingResult = await performanceHelper.measureOperation(
        'ranking-search',
        async () => {
          const results = await kb.search(rankingQuery, { 
            useAI: false, 
            limit: 50,
            includeRelevanceScore: true 
          });
          
          // Verify results are properly ranked
          for (let i = 0; i < results.length - 1; i++) {
            expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
          }
          
          return results;
        },
        20
      );

      expect(rankingResult.success).toBe(true);
      expect(rankingResult.metrics.operationsPerSecond).toBeGreaterThan(30);
    });
  });

  describe('Cache Performance Metrics', () => {
    it('should demonstrate significant cache hit improvements', async () => {
      const cacheQuery = 'frequent cache test query';

      // First query (cache miss)
      const missResult = await performanceHelper.measureOperation(
        'cache-miss',
        () => kb.search(cacheQuery, { useAI: false }),
        1
      );

      // Subsequent queries (cache hits)
      const hitResult = await performanceHelper.measureOperation(
        'cache-hit',
        () => kb.search(cacheQuery, { useAI: false }),
        100
      );

      expect(missResult.success).toBe(true);
      expect(hitResult.success).toBe(true);
      
      // Cache hits should be at least 3x faster
      expect(hitResult.metrics.operationsPerSecond).toBeGreaterThan(missResult.metrics.operationsPerSecond! * 3);
      
      // Cache hits should execute very quickly
      expect(hitResult.metrics.executionTime / hitResult.iterations).toBeLessThan(10);
    });

    it('should maintain cache performance under pressure', async () => {
      // Create a workload that will cause cache eviction
      const queries = Array(1500).fill(0).map((_, i) => `unique query number ${i}`);
      
      // Fill cache beyond capacity
      for (let i = 0; i < queries.length; i += 100) {
        const batch = queries.slice(i, i + 100);
        await Promise.all(batch.map(q => kb.search(q, { useAI: false })));
      }

      // Test cache performance under pressure
      const pressureResult = await performanceHelper.measureOperation(
        'cache-under-pressure',
        async () => {
          // Mix of cached and new queries
          const mixedQueries = [
            ...queries.slice(-10), // Recent queries (likely cached)
            ...Array(10).fill(0).map((_, i) => `new query ${Date.now()}-${i}`) // New queries
          ];
          
          for (const query of mixedQueries) {
            await kb.search(query, { useAI: false });
          }
        },
        5
      );

      expect(pressureResult.success).toBe(true);
      expect(pressureResult.metrics.executionTime / pressureResult.iterations).toBeLessThan(2000);
    });

    it('should validate cache eviction policies', async () => {
      const cacheCapacityTest = async () => {
        // Generate queries to exceed cache capacity
        const queries = Array(2000).fill(0).map((_, i) => `capacity test query ${i}`);
        
        // Execute queries sequentially to test LRU eviction
        for (const query of queries) {
          await kb.search(query, { useAI: false });
        }

        // Test that recent queries are still fast (cached)
        const recentQueries = queries.slice(-100);
        const recentResults = await Promise.all(
          recentQueries.map(async query => {
            const start = performance.now();
            await kb.search(query, { useAI: false });
            return performance.now() - start;
          })
        );

        // Recent queries should be fast (average < 50ms)
        const avgRecentTime = recentResults.reduce((sum, time) => sum + time, 0) / recentResults.length;
        expect(avgRecentTime).toBeLessThan(50);
      };

      await expect(cacheCapacityTest()).resolves.not.toThrow();
    });
  });

  describe('Concurrent Search Operations', () => {
    it('should handle concurrent searches without performance degradation', async () => {
      const concurrentQueries = [
        'VSAM error',
        'data exception',
        'JCL dataset',
        'DB2 timeout',
        'system abend',
        'file error',
        'batch failed',
        'connection lost',
        'memory issue',
        'process hang'
      ];

      const concurrentOperations = concurrentQueries.map(query => 
        () => kb.search(query, { useAI: false, limit: 10 })
      );

      const concurrentResult = await performanceHelper.runLoadTest({
        concurrentUsers: 10,
        duration: 15, // 15 seconds
        rampUpTime: 3, // 3 seconds ramp-up
        operations: concurrentOperations
      });

      const successRate = concurrentResult.filter(r => r.success).length / concurrentResult.length;
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate

      // Average response time should remain reasonable
      const avgTime = concurrentResult
        .filter(r => r.success)
        .reduce((sum, r) => sum + r.metrics.executionTime, 0) / concurrentResult.filter(r => r.success).length;
      
      expect(avgTime).toBeLessThan(1500); // Allow some overhead for concurrency
    });

    it('should maintain search quality under concurrent load', async () => {
      const testQuery = 'VSAM status 35 file not found';
      const expectedMinResults = 3; // Should find at least 3 relevant entries

      const concurrentSearches = Array(20).fill(0).map(() => 
        () => kb.search(testQuery, { useAI: false, limit: 10 })
      );

      const results = await Promise.all(
        concurrentSearches.map(searchFn => searchFn())
      );

      // All searches should return consistent results
      results.forEach(searchResults => {
        expect(searchResults.length).toBeGreaterThanOrEqual(expectedMinResults);
        // Results should be properly scored
        for (let i = 0; i < searchResults.length - 1; i++) {
          expect(searchResults[i].score).toBeGreaterThanOrEqual(searchResults[i + 1].score);
        }
      });
    });

    it('should handle search request spikes gracefully', async () => {
      // Simulate sudden spike in search requests
      const spikeOperations = Array(50).fill(0).map((_, i) => 
        () => kb.search(`spike test query ${i % 10}`, { useAI: false, limit: 5 })
      );

      const spikeResult = await performanceHelper.runLoadTest({
        concurrentUsers: 20, // High concurrency
        duration: 5, // Short duration for spike
        rampUpTime: 0.5, // Very fast ramp-up
        operations: spikeOperations
      });

      const successRate = spikeResult.filter(r => r.success).length / spikeResult.length;
      expect(successRate).toBeGreaterThan(0.85); // Should handle spike reasonably well

      // System should remain responsive
      const maxTime = Math.max(...spikeResult.filter(r => r.success).map(r => r.metrics.executionTime));
      expect(maxTime).toBeLessThan(5000); // No request should take more than 5s
    });
  });

  describe('Search Performance Regression Detection', () => {
    it('should detect performance regressions in search operations', async () => {
      // Establish baseline performance
      const baselineQueries = [
        'system error',
        'data processing',
        'file operations',
        'network issues',
        'batch processing'
      ];

      const baselineResults = await performanceHelper.compareImplementations(
        baselineQueries.map(query => ({
          name: `baseline-${query.replace(/\s+/g, '-')}`,
          fn: () => kb.search(query, { useAI: false, limit: 10 })
        })),
        20
      );

      // Simulate system under different conditions
      await this.simulateSystemLoad();

      // Run same tests under load
      const loadResults = await performanceHelper.compareImplementations(
        baselineQueries.map(query => ({
          name: `baseline-${query.replace(/\s+/g, '-')}`,
          fn: () => kb.search(query, { useAI: false, limit: 10 })
        })),
        20
      );

      // Analyze regression
      const regressionAnalysis = performanceHelper.analyzeRegression(
        Object.values(baselineResults),
        Object.values(loadResults),
        0.5 // 50% degradation threshold for this test
      );

      // Most tests should not show significant regression
      const regressions = regressionAnalysis.filter(r => r.isRegression);
      expect(regressions.length).toBeLessThan(baselineQueries.length * 0.3); // Less than 30% regression
    });

    private async simulateSystemLoad(): Promise<void> {
      // Simulate background database operations
      const loadOperations = Array(100).fill(0).map(() =>
        dbManager.execute('SELECT COUNT(*) FROM kb_entries WHERE created_at > datetime("now", "-1 day")')
      );
      
      await Promise.all(loadOperations);
    }
  });
});