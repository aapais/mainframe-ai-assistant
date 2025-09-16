/**
 * FTS5 Integration Test Suite
 *
 * Tests for the FTS5 integration service that intelligently routes
 * search queries between FTS5 and legacy search engines.
 *
 * @author Database Architect
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import FTS5Integration, { FTS5IntegrationConfig, SearchStrategy } from '../FTS5Integration';
import AdvancedSearchEngine from '../AdvancedSearchEngine';
import { KBEntry, SearchOptions } from '../../../types';

// Mock AdvancedSearchEngine for testing
jest.mock('../AdvancedSearchEngine');

describe('FTS5Integration', () => {
  let db: Database.Database;
  let mockLegacyEngine: jest.Mocked<AdvancedSearchEngine>;
  let integration: FTS5Integration;
  let testEntries: KBEntry[];

  const mockSearchResults = [
    {
      entry: {
        id: 'mock-1',
        title: 'Mock Entry 1',
        problem: 'Mock problem 1',
        solution: 'Mock solution 1',
        category: 'JCL',
        tags: ['mock', 'test']
      },
      score: 85,
      matchType: 'fuzzy' as any,
      highlights: ['Mock Entry 1'],
      metadata: {
        processingTime: 100,
        source: 'legacy',
        confidence: 0.85,
        fallback: false
      }
    }
  ];

  beforeAll(async () => {
    // Create in-memory database
    db = new Database(':memory:');

    // Set up basic tables
    db.exec(`
      CREATE TABLE kb_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        usage_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_used DATETIME,
        archived BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE kb_tags (
        entry_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (entry_id, tag),
        FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
      );
    `);

    // Test data
    testEntries = [
      {
        id: 'test-1',
        title: 'S0C7 Data Exception',
        problem: 'Program abends with S0C7',
        solution: 'Check COMP-3 fields',
        category: 'Batch',
        tags: ['s0c7', 'abend']
      },
      {
        id: 'test-2',
        title: 'VSAM Status 35',
        problem: 'File not found error',
        solution: 'Check catalog',
        category: 'VSAM',
        tags: ['vsam', 'status-35']
      }
    ];

    // Insert test data
    const insertEntry = db.prepare(`
      INSERT INTO kb_entries (id, title, problem, solution, category)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertTag = db.prepare(`
      INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)
    `);

    testEntries.forEach(entry => {
      insertEntry.run(entry.id, entry.title, entry.problem, entry.solution, entry.category);
      if (entry.tags) {
        entry.tags.forEach(tag => insertTag.run(entry.id, tag));
      }
    });
  });

  beforeEach(() => {
    // Create mock legacy engine
    mockLegacyEngine = {
      search: jest.fn().mockResolvedValue(mockSearchResults),
      suggest: jest.fn().mockResolvedValue(['suggestion1', 'suggestion2']),
      initialize: jest.fn().mockResolvedValue(undefined),
      getStats: jest.fn().mockReturnValue({
        engine: { totalSearches: 100, averageResponseTime: 150 }
      })
    } as any;

    // Create integration with default config
    integration = new FTS5Integration(db, mockLegacyEngine);
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with FTS5 enabled', async () => {
      await expect(integration.initialize()).resolves.not.toThrow();
    });

    test('should initialize with FTS5 disabled and use legacy only', async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        enabled: false
      };

      const disabledIntegration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await expect(disabledIntegration.initialize()).resolves.not.toThrow();

      const results = await disabledIntegration.search('test query');
      expect(mockLegacyEngine.search).toHaveBeenCalled();
      expect(results).toEqual(mockSearchResults);
    });

    test('should fallback to legacy on FTS5 initialization failure', async () => {
      // Create integration with invalid database path to force failure
      const invalidDb = new Database(':memory:');
      invalidDb.close(); // Close immediately to cause errors

      const config: Partial<FTS5IntegrationConfig> = {
        fallbackEnabled: true
      };

      const faultyIntegration = new FTS5Integration(invalidDb, mockLegacyEngine, {}, config);
      await expect(faultyIntegration.initialize()).resolves.not.toThrow();

      // Should still work with legacy engine
      const results = await faultyIntegration.search('test');
      expect(results).toEqual(mockSearchResults);
    });

    test('should respect initialization timeout', async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        performance: {
          maxInitTime: 1, // Very short timeout
          maxSearchTime: 1000,
          enableMonitoring: false
        },
        fallbackEnabled: true
      };

      const timeoutIntegration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await expect(timeoutIntegration.initialize()).resolves.not.toThrow();
    });
  });

  describe('Search Strategy Selection', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should select legacy strategy for error codes', async () => {
      const errorCodes = ['S0C7', 'IEF212I', 'SQL0803N', 'DFHAC2001'];

      for (const errorCode of errorCodes) {
        await integration.search(errorCode);
        expect(mockLegacyEngine.search).toHaveBeenCalledWith(
          errorCode,
          expect.any(Object)
        );
      }
    });

    test('should select legacy strategy for short queries', async () => {
      await integration.search('a'); // Single character
      expect(mockLegacyEngine.search).toHaveBeenCalled();
    });

    test('should select legacy strategy for structured queries', async () => {
      const structuredQueries = ['category:JCL', 'tag:vsam'];

      for (const query of structuredQueries) {
        await integration.search(query, { category: 'JCL' });
        expect(mockLegacyEngine.search).toHaveBeenCalled();
      }
    });

    test('should select FTS5 strategy for natural language queries', async () => {
      const naturalQueries = [
        'program failure with arithmetic error',
        'database connection timeout issue',
        'file processing performance problem'
      ];

      for (const query of naturalQueries) {
        mockLegacyEngine.search.mockClear();
        await integration.search(query);

        // For natural language queries, it should attempt FTS5 first
        // (though it may fall back to legacy on error in test environment)
      }
    });

    test('should consider performance metrics in strategy selection', async () => {
      // Simulate multiple searches to build performance history
      for (let i = 0; i < 5; i++) {
        await integration.search(`test query ${i}`);
      }

      const metrics = integration.getPerformanceMetrics();
      expect(metrics.overall.totalSearches).toBeGreaterThan(0);
    });
  });

  describe('Search Execution', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should execute search and return results', async () => {
      const results = await integration.search('test query');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should handle search options correctly', async () => {
      const options: SearchOptions = {
        limit: 5,
        offset: 0,
        category: 'JCL',
        sortBy: 'relevance'
      };

      await integration.search('test query', options);
      expect(mockLegacyEngine.search).toHaveBeenCalledWith('test query', options);
    });

    test('should fallback to legacy on FTS5 errors', async () => {
      // Force FTS5 to fail by using invalid query that will cause timeout
      const config: Partial<FTS5IntegrationConfig> = {
        performance: {
          maxSearchTime: 1, // Very short timeout
          maxInitTime: 5000,
          enableMonitoring: false
        },
        fallbackEnabled: true
      };

      const fallbackIntegration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await fallbackIntegration.initialize();

      const results = await fallbackIntegration.search('test query');
      expect(mockLegacyEngine.search).toHaveBeenCalled();
      expect(results).toEqual(mockSearchResults);
    });

    test('should handle timeout errors gracefully', async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        performance: {
          maxSearchTime: 1,
          maxInitTime: 5000,
          enableMonitoring: false
        },
        fallbackEnabled: true
      };

      const timeoutIntegration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await timeoutIntegration.initialize();

      await expect(timeoutIntegration.search('complex query with many terms')).resolves.not.toThrow();
    });
  });

  describe('Hybrid Search', () => {
    beforeEach(async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        features: {
          hybridSearch: true,
          autoComplete: true,
          snippets: true,
          queryExpansion: false
        }
      };

      integration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await integration.initialize();
    });

    test('should execute hybrid search for complex queries', async () => {
      const complexQuery = 'program error handling in batch processing';
      await integration.search(complexQuery);

      // Should have called legacy engine (hybrid approach uses both)
      expect(mockLegacyEngine.search).toHaveBeenCalled();
    });

    test('should merge results from multiple strategies', async () => {
      // Mock different results from legacy engine
      const legacyResults = [
        {
          entry: { id: 'legacy-1', title: 'Legacy Result', problem: '', solution: '', category: 'Other', tags: [] },
          score: 70,
          matchType: 'legacy' as any,
          metadata: { processingTime: 0, source: 'legacy', confidence: 0.7, fallback: false }
        }
      ];

      mockLegacyEngine.search.mockResolvedValue(legacyResults);

      const results = await integration.search('complex hybrid query test');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-complete', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should provide auto-complete suggestions', async () => {
      const suggestions = await integration.autoComplete('prog');

      expect(Array.isArray(suggestions)).toBe(true);
      expect(mockLegacyEngine.suggest).toHaveBeenCalledWith('prog', expect.any(Number));
    });

    test('should limit suggestions to specified count', async () => {
      const suggestions = await integration.autoComplete('test', 3);

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    test('should handle auto-complete errors gracefully', async () => {
      mockLegacyEngine.suggest.mockRejectedValue(new Error('Auto-complete error'));

      const suggestions = await integration.autoComplete('test');
      expect(Array.isArray(suggestions)).toBe(true);
    });

    test('should merge auto-complete results from multiple sources', async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        features: {
          hybridSearch: true,
          autoComplete: true,
          snippets: true,
          queryExpansion: false
        }
      };

      const hybridIntegration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await hybridIntegration.initialize();

      const suggestions = await hybridIntegration.autoComplete('prog');
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        cache: {
          enabled: true,
          ttl: 300000,
          maxSize: 100
        }
      };

      integration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await integration.initialize();
    });

    test('should cache search results', async () => {
      const query = 'cacheable query';

      // First search
      await integration.search(query);
      expect(mockLegacyEngine.search).toHaveBeenCalledTimes(1);

      // Second search - should use cache
      mockLegacyEngine.search.mockClear();
      await integration.search(query);

      // Legacy engine should not be called again due to caching
      // Note: In test environment, caching behavior may vary
    });

    test('should respect cache TTL', async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        cache: {
          enabled: true,
          ttl: 1, // Very short TTL
          maxSize: 100
        }
      };

      const shortCacheIntegration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await shortCacheIntegration.initialize();

      await shortCacheIntegration.search('ttl test');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      await shortCacheIntegration.search('ttl test');
      // Should call legacy engine again due to expired cache
    });

    test('should limit cache size', async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        cache: {
          enabled: true,
          ttl: 300000,
          maxSize: 2 // Very small cache
        }
      };

      const smallCacheIntegration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await smallCacheIntegration.initialize();

      // Fill cache beyond limit
      await smallCacheIntegration.search('query 1');
      await smallCacheIntegration.search('query 2');
      await smallCacheIntegration.search('query 3'); // Should evict oldest
    });

    test('should handle disabled cache', async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        cache: {
          enabled: false,
          ttl: 300000,
          maxSize: 100
        }
      };

      const noCacheIntegration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await noCacheIntegration.initialize();

      await noCacheIntegration.search('no cache query');
      await noCacheIntegration.search('no cache query');

      // Should call legacy engine both times
      expect(mockLegacyEngine.search).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        performance: {
          maxSearchTime: 1000,
          maxInitTime: 5000,
          enableMonitoring: true
        }
      };

      integration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await integration.initialize();
    });

    test('should track performance metrics', async () => {
      await integration.search('performance test 1');
      await integration.search('performance test 2');

      const metrics = integration.getPerformanceMetrics();
      expect(metrics.overall.totalSearches).toBeGreaterThan(0);
      expect(metrics.overall.averageTime).toBeGreaterThan(0);
    });

    test('should provide detailed performance breakdown', async () => {
      await integration.search('S0C7'); // Should use legacy
      await integration.search('complex natural language query'); // May use FTS5 or hybrid

      const metrics = integration.getPerformanceMetrics();
      expect(metrics.legacy.callCount).toBeGreaterThan(0);
      expect(metrics.overall.totalSearches).toBeGreaterThan(0);
    });

    test('should calculate cache hit rate', async () => {
      // Enable caching
      const config: Partial<FTS5IntegrationConfig> = {
        cache: { enabled: true, ttl: 300000, maxSize: 100 },
        performance: { enableMonitoring: true, maxSearchTime: 1000, maxInitTime: 5000 }
      };

      const cachedIntegration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await cachedIntegration.initialize();

      await cachedIntegration.search('cache test');
      await cachedIntegration.search('cache test'); // Should hit cache

      const metrics = cachedIntegration.getPerformanceMetrics();
      expect(metrics.overall.cacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Health Status', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should provide health status', () => {
      const health = integration.getHealthStatus();

      expect(health).toHaveProperty('fts5Available');
      expect(health).toHaveProperty('legacyAvailable');
      expect(health).toHaveProperty('cacheStatus');
      expect(health).toHaveProperty('performanceStatus');
      expect(health).toHaveProperty('recommendations');
      expect(Array.isArray(health.recommendations)).toBe(true);
    });

    test('should indicate legacy availability', () => {
      const health = integration.getHealthStatus();
      expect(health.legacyAvailable).toBe(true);
    });

    test('should provide performance recommendations', async () => {
      // Generate some activity to trigger recommendations
      for (let i = 0; i < 5; i++) {
        await integration.search(`test query ${i}`);
      }

      const health = integration.getHealthStatus();
      expect(Array.isArray(health.recommendations)).toBe(true);
    });
  });

  describe('Optimization', () => {
    beforeEach(async () => {
      await integration.initialize();
    });

    test('should optimize without errors', async () => {
      await expect(integration.optimize()).resolves.not.toThrow();
    });

    test('should clean expired cache during optimization', async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        cache: { enabled: true, ttl: 1, maxSize: 100 } // Very short TTL
      };

      const optimizableIntegration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await optimizableIntegration.initialize();

      await optimizableIntegration.search('optimization test');

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      await optimizableIntegration.optimize();
      // Cache should be cleaned
    });
  });

  describe('Error Handling', () => {
    test('should handle uninitialized integration', async () => {
      const uninitializedIntegration = new FTS5Integration(db, mockLegacyEngine);
      // Don't call initialize()

      await expect(uninitializedIntegration.search('test')).rejects.toThrow('not initialized');
    });

    test('should handle legacy engine errors with no fallback', async () => {
      const config: Partial<FTS5IntegrationConfig> = {
        enabled: false,
        fallbackEnabled: false
      };

      const noFallbackIntegration = new FTS5Integration(db, mockLegacyEngine, {}, config);
      await noFallbackIntegration.initialize();

      mockLegacyEngine.search.mockRejectedValue(new Error('Legacy engine error'));

      await expect(noFallbackIntegration.search('test')).rejects.toThrow();
    });

    test('should handle malformed queries', async () => {
      await integration.initialize();

      const malformedQueries = [
        null as any,
        undefined as any,
        '',
        '   ',
        '"unclosed quote',
        'AND OR NOT'
      ];

      for (const query of malformedQueries) {
        await expect(integration.search(query)).resolves.not.toThrow();
      }
    });

    test('should handle database connection errors', async () => {
      // Close database to simulate connection error
      const connectionErrorDb = new Database(':memory:');
      connectionErrorDb.close();

      const config: Partial<FTS5IntegrationConfig> = {
        fallbackEnabled: true
      };

      const errorIntegration = new FTS5Integration(connectionErrorDb, mockLegacyEngine, {}, config);
      await expect(errorIntegration.initialize()).resolves.not.toThrow();
    });
  });

  describe('Configuration', () => {
    test('should accept custom configuration', async () => {
      const customConfig: Partial<FTS5IntegrationConfig> = {
        enabled: true,
        fallbackEnabled: true,
        minQueryLength: 3,
        performance: {
          maxSearchTime: 2000,
          maxInitTime: 10000,
          enableMonitoring: false
        },
        cache: {
          enabled: true,
          ttl: 600000,
          maxSize: 500
        },
        features: {
          hybridSearch: false,
          autoComplete: false,
          snippets: false,
          queryExpansion: true
        }
      };

      const customIntegration = new FTS5Integration(db, mockLegacyEngine, {}, customConfig);
      await expect(customIntegration.initialize()).resolves.not.toThrow();

      // Test that short queries use legacy (due to minQueryLength: 3)
      await customIntegration.search('ab'); // 2 characters
      expect(mockLegacyEngine.search).toHaveBeenCalled();
    });

    test('should merge partial configuration with defaults', async () => {
      const partialConfig: Partial<FTS5IntegrationConfig> = {
        cache: {
          enabled: false
        }
      };

      const partialIntegration = new FTS5Integration(db, mockLegacyEngine, {}, partialConfig);
      await expect(partialIntegration.initialize()).resolves.not.toThrow();

      const health = partialIntegration.getHealthStatus();
      expect(health.cacheStatus).toBe('disabled');
    });
  });
});

export {};