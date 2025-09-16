import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CacheServiceIntegration } from '../../src/services/cache/CacheServiceIntegration';
import { createCacheConfig } from '../../src/services/cache/CacheConfig';

describe('CacheServiceIntegration', () => {
  let cacheService: CacheServiceIntegration;

  beforeEach(async () => {
    cacheService = new CacheServiceIntegration({
      legacyCache: {
        maxSize: 100,
        defaultTTL: 60000,
        checkPeriod: 30000
      },
      multiLayer: {
        ...createCacheConfig(),
        memory: {
          maxSize: 200,
          defaultTTL: 300,
          cleanupInterval: 60000,
          enableLRU: true,
          maxMemoryUsage: 10 * 1024 * 1024 // 10MB
        }
      },
      monitoring: {
        enabled: true,
        interval: 5000
      },
      warming: {
        enabled: true,
        onStartup: false, // Disable for tests
        strategies: ['popular']
      }
    });

    await cacheService.initialize();
  });

  afterEach(async () => {
    await cacheService.destroy();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve values', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', timestamp: Date.now() };

      const success = await cacheService.set(key, value);
      expect(success).toBe(true);

      const retrieved = await cacheService.get(key);
      expect(retrieved).toEqual(value);
    });

    it('should handle cache misses gracefully', async () => {
      const result = await cacheService.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should use fallback function when cache misses', async () => {
      const fallbackValue = { computed: true };
      const fallback = jest.fn().mockResolvedValue(fallbackValue);

      const result = await cacheService.get('missing-key', { fallback });
      
      expect(fallback).toHaveBeenCalled();
      expect(result).toEqual(fallbackValue);
      
      // Should now be cached
      const cached = await cacheService.get('missing-key');
      expect(cached).toEqual(fallbackValue);
    });

    it('should handle TTL expiration', async () => {
      const key = 'ttl-test';
      const value = 'expires-soon';
      const shortTTL = 100; // 100ms

      await cacheService.set(key, value, shortTTL);
      
      // Should be available immediately
      let cached = await cacheService.get(key);
      expect(cached).toBe(value);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      cached = await cacheService.get(key);
      expect(cached).toBeNull();
    });

    it('should delete values from both caches', async () => {
      const key = 'delete-test';
      const value = 'to-be-deleted';

      await cacheService.set(key, value);
      
      // Verify it exists
      let cached = await cacheService.get(key);
      expect(cached).toBe(value);
      
      // Delete it
      const deleted = await cacheService.del(key);
      expect(deleted).toBe(true);
      
      // Verify it's gone
      cached = await cacheService.get(key);
      expect(cached).toBeNull();
    });
  });

  describe('Query Caching', () => {
    it('should cache search queries', async () => {
      const query = 'mainframe programming';
      const filters = { category: 'cobol', difficulty: 'beginner' };
      const mockResults = {
        results: [
          { id: 1, title: 'COBOL Basics', relevance: 0.95 },
          { id: 2, title: 'Mainframe Overview', relevance: 0.88 }
        ],
        total: 2
      };
      
      const executor = jest.fn().mockResolvedValue(mockResults);
      
      // First call should execute
      const result1 = await cacheService.cacheSearchQuery(query, filters, executor);
      expect(executor).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockResults);
      
      // Second call should use cache
      const result2 = await cacheService.cacheSearchQuery(query, filters, executor);
      expect(executor).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toEqual(mockResults);
    });

    it('should cache database queries', async () => {
      const sql = 'SELECT * FROM knowledge_base WHERE category = ? ORDER BY updated_at DESC';
      const params = ['cobol'];
      const mockData = [
        { id: 1, title: 'COBOL Best Practices', category: 'cobol' },
        { id: 2, title: 'Modern COBOL', category: 'cobol' }
      ];
      
      const executor = jest.fn().mockResolvedValue(mockData);
      
      // First call should execute
      const result1 = await cacheService.cacheDbQuery(sql, params, executor);
      expect(executor).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockData);
      
      // Second call should use cache
      const result2 = await cacheService.cacheDbQuery(sql, params, executor);
      expect(executor).toHaveBeenCalledTimes(1);
      expect(result2).toEqual(mockData);
    });
  });

  describe('Tag-based Invalidation', () => {
    it('should invalidate cache entries by tag', async () => {
      // Set some tagged entries
      await cacheService.set('search:1', 'result1', 300000, ['search', 'popular']);
      await cacheService.set('search:2', 'result2', 300000, ['search', 'recent']);
      await cacheService.set('user:1', 'profile1', 300000, ['user']);
      
      // Verify they exist
      expect(await cacheService.get('search:1')).toBe('result1');
      expect(await cacheService.get('search:2')).toBe('result2');
      expect(await cacheService.get('user:1')).toBe('profile1');
      
      // Invalidate search entries
      const invalidated = await cacheService.invalidateByTag('search');
      expect(invalidated).toBeGreaterThan(0);
      
      // Search entries should be gone
      expect(await cacheService.get('search:1')).toBeNull();
      expect(await cacheService.get('search:2')).toBeNull();
      
      // User entry should remain
      expect(await cacheService.get('user:1')).toBe('profile1');
    });
  });

  describe('Performance Monitoring', () => {
    it('should collect performance metrics', async () => {
      // Perform some cache operations
      await cacheService.set('metric-test-1', 'value1');
      await cacheService.set('metric-test-2', 'value2');
      await cacheService.get('metric-test-1');
      await cacheService.get('metric-test-1'); // Hit
      await cacheService.get('metric-test-2');
      await cacheService.get('non-existent'); // Miss
      
      // Wait a moment for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = cacheService.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      
      if (metrics && typeof metrics === 'object' && 'cache' in metrics) {
        expect(metrics.cache.operations.total).toBeGreaterThan(0);
        expect(metrics.cache.operations.hits).toBeGreaterThan(0);
      }
    });

    it('should generate performance reports', async () => {
      const report = cacheService.getPerformanceReport('1h');
      
      if (report) {
        expect(report.summary).toBeDefined();
        expect(report.summary.overallScore).toBeGreaterThanOrEqual(0);
        expect(report.summary.overallScore).toBeLessThanOrEqual(100);
        expect(report.recommendations).toBeInstanceOf(Array);
      }
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health status', async () => {
      const health = await cacheService.getHealthStatus();
      
      expect(health).toBeDefined();
      expect(health.overall).toMatch(/healthy|degraded|unhealthy/);
      expect(health.migration).toBeDefined();
    });
  });

  describe('CDN Integration', () => {
    it('should generate CDN URLs when CDN is disabled', () => {
      const assetPath = '/assets/css/main.css';
      const cdnUrl = cacheService.getCDNUrl(assetPath);
      
      // Should return original path when CDN is disabled
      expect(cdnUrl).toBe(assetPath);
    });
  });

  describe('Cache Flushing', () => {
    it('should flush all cache entries', async () => {
      // Add some entries
      await cacheService.set('flush-test-1', 'value1');
      await cacheService.set('flush-test-2', 'value2');
      
      // Verify they exist
      expect(await cacheService.get('flush-test-1')).toBe('value1');
      expect(await cacheService.get('flush-test-2')).toBe('value2');
      
      // Flush cache
      await cacheService.flush();
      
      // Verify they're gone
      expect(await cacheService.get('flush-test-1')).toBeNull();
      expect(await cacheService.get('flush-test-2')).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      // Test with invalid key
      const result = await cacheService.get('');
      expect(result).toBeNull();
    });

    it('should handle fallback errors', async () => {
      const errorFallback = jest.fn().mockRejectedValue(new Error('Fallback failed'));
      
      const result = await cacheService.get('error-test', { fallback: errorFallback });
      expect(result).toBeNull();
      expect(errorFallback).toHaveBeenCalled();
    });
  });

  describe('Initialization and Cleanup', () => {
    it('should indicate initialization status', () => {
      expect(cacheService.isInitialized()).toBe(true);
    });

    it('should handle multiple initialization calls', async () => {
      // Should not throw or cause issues
      await cacheService.initialize();
      expect(cacheService.isInitialized()).toBe(true);
    });
  });
});

// Performance benchmark tests
describe('CacheServiceIntegration Performance', () => {
  let cacheService: CacheServiceIntegration;

  beforeEach(async () => {
    cacheService = new CacheServiceIntegration({
      legacyCache: {
        maxSize: 1000,
        defaultTTL: 60000,
        checkPeriod: 30000
      },
      monitoring: { enabled: false }, // Disable for performance tests
      warming: { enabled: false }
    });
    
    await cacheService.initialize();
  });

  afterEach(async () => {
    await cacheService.destroy();
  });

  it('should handle high-frequency operations', async () => {
    const operationCount = 1000;
    const startTime = Date.now();
    
    // Perform bulk operations
    const operations = [];
    for (let i = 0; i < operationCount; i++) {
      operations.push(cacheService.set(`key-${i}`, `value-${i}`));
    }
    
    await Promise.all(operations);
    
    // Perform bulk reads
    const readOperations = [];
    for (let i = 0; i < operationCount; i++) {
      readOperations.push(cacheService.get(`key-${i}`));
    }
    
    const results = await Promise.all(readOperations);
    const endTime = Date.now();
    
    // Verify all operations completed
    expect(results).toHaveLength(operationCount);
    expect(results.every((result, i) => result === `value-${i}`)).toBe(true);
    
    // Performance check - should complete within reasonable time
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(5000); // 5 seconds for 2000 operations
    
    console.log(`Performance test: ${operationCount * 2} operations in ${duration}ms`);
  });

  it('should maintain performance under cache pressure', async () => {
    const cacheSize = 100;
    const operationMultiplier = 3; // 3x cache size
    
    // Fill cache beyond capacity to trigger evictions
    for (let i = 0; i < cacheSize * operationMultiplier; i++) {
      await cacheService.set(`pressure-key-${i}`, `pressure-value-${i}`);
    }
    
    // Recent entries should still be available
    const recentKey = `pressure-key-${cacheSize * operationMultiplier - 1}`;
    const recentValue = await cacheService.get(recentKey);
    expect(recentValue).toBe(`pressure-value-${cacheSize * operationMultiplier - 1}`);
    
    // Old entries should be evicted
    const oldKey = 'pressure-key-0';
    const oldValue = await cacheService.get(oldKey);
    expect(oldValue).toBeNull();
  });
});

// Integration tests with real-world scenarios
describe('CacheServiceIntegration Real-World Scenarios', () => {
  let cacheService: CacheServiceIntegration;

  beforeEach(async () => {
    cacheService = new CacheServiceIntegration({
      legacyCache: {
        maxSize: 500,
        defaultTTL: 300000, // 5 minutes
        checkPeriod: 60000
      },
      multiLayer: {
        ...createCacheConfig(),
        queryCache: {
          enabled: true,
          defaultTTL: 600, // 10 minutes
          maxQueries: 100
        }
      },
      monitoring: { enabled: true, interval: 10000 },
      warming: { enabled: false } // Disable for deterministic tests
    });
    
    await cacheService.initialize();
  });

  afterEach(async () => {
    await cacheService.destroy();
  });

  it('should handle typical mainframe knowledge base queries', async () => {
    // Simulate typical knowledge base search patterns
    const searchQueries = [
      { query: 'COBOL programming basics', filters: { category: 'programming' } },
      { query: 'JCL job control language', filters: { category: 'system' } },
      { query: 'DB2 database queries', filters: { category: 'database' } },
      { query: 'VSAM file processing', filters: { category: 'data-management' } }
    ];
    
    const mockSearchResults = (query: string) => ({
      query,
      results: [
        { id: 1, title: `${query} - Guide 1`, relevance: 0.9 },
        { id: 2, title: `${query} - Guide 2`, relevance: 0.8 }
      ],
      timestamp: Date.now()
    });
    
    // First round - should execute all queries
    const firstRoundPromises = searchQueries.map(({ query, filters }) => {
      const executor = jest.fn().mockResolvedValue(mockSearchResults(query));
      return cacheService.cacheSearchQuery(query, filters, executor).then(result => ({ result, executor }));
    });
    
    const firstRound = await Promise.all(firstRoundPromises);
    
    // Verify all executors were called
    firstRound.forEach(({ executor }) => {
      expect(executor).toHaveBeenCalledTimes(1);
    });
    
    // Second round - should use cache
    const secondRoundPromises = searchQueries.map(({ query, filters }) => {
      const executor = jest.fn().mockResolvedValue(mockSearchResults(query));
      return cacheService.cacheSearchQuery(query, filters, executor).then(result => ({ result, executor }));
    });
    
    const secondRound = await Promise.all(secondRoundPromises);
    
    // Verify no executors were called (cache hits)
    secondRound.forEach(({ executor }) => {
      expect(executor).not.toHaveBeenCalled();
    });
    
    // Verify results are consistent
    for (let i = 0; i < searchQueries.length; i++) {
      expect(firstRound[i].result.query).toBe(secondRound[i].result.query);
    }
  });

  it('should handle database query caching for mainframe systems', async () => {
    const dbQueries = [
      {
        sql: 'SELECT * FROM COBOL_PROGRAMS WHERE STATUS = ? ORDER BY LAST_MODIFIED DESC',
        params: ['ACTIVE'],
        mockData: [
          { program_id: 'PROG001', name: 'PAYROLL.COB', status: 'ACTIVE' },
          { program_id: 'PROG002', name: 'INVENTORY.COB', status: 'ACTIVE' }
        ]
      },
      {
        sql: 'SELECT * FROM JCL_JOBS WHERE JOB_CLASS = ? AND DATE_SUBMITTED >= ?',
        params: ['A', '2024-01-01'],
        mockData: [
          { job_id: 'JOB001', job_name: 'DAILYRUN', job_class: 'A' },
          { job_id: 'JOB002', job_name: 'BACKUP', job_class: 'A' }
        ]
      }
    ];
    
    // Execute queries first time
    const firstExecution = await Promise.all(
      dbQueries.map(({ sql, params, mockData }) => {
        const executor = jest.fn().mockResolvedValue(mockData);
        return cacheService.cacheDbQuery(sql, params, executor, 600).then(result => ({ result, executor }));
      })
    );
    
    // Execute queries second time
    const secondExecution = await Promise.all(
      dbQueries.map(({ sql, params, mockData }) => {
        const executor = jest.fn().mockResolvedValue(mockData);
        return cacheService.cacheDbQuery(sql, params, executor, 600).then(result => ({ result, executor }));
      })
    );
    
    // First execution should have called executors
    firstExecution.forEach(({ executor }) => {
      expect(executor).toHaveBeenCalledTimes(1);
    });
    
    // Second execution should use cache
    secondExecution.forEach(({ executor }) => {
      expect(executor).not.toHaveBeenCalled();
    });
    
    // Results should be identical
    for (let i = 0; i < dbQueries.length; i++) {
      expect(firstExecution[i].result).toEqual(secondExecution[i].result);
    }
  });

  it('should handle cache invalidation on data updates', async () => {
    // Cache some data
    await cacheService.set('kb:entry:123', { id: 123, title: 'COBOL Guide', content: 'Original content' }, 300000, ['kb', 'cobol']);
    await cacheService.set('search:cobol:basic', { results: [{ id: 123, title: 'COBOL Guide' }] }, 300000, ['search', 'cobol']);
    
    // Verify data is cached
    expect(await cacheService.get('kb:entry:123')).toBeTruthy();
    expect(await cacheService.get('search:cobol:basic')).toBeTruthy();
    
    // Simulate data update - invalidate related caches
    const invalidated = await cacheService.invalidateByTag('cobol');
    expect(invalidated).toBeGreaterThan(0);
    
    // Verify caches are cleared
    expect(await cacheService.get('kb:entry:123')).toBeNull();
    expect(await cacheService.get('search:cobol:basic')).toBeNull();
  });
});
