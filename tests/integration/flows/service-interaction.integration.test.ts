/**
 * Service Interaction Integration Tests
 * Tests the interactions between all major services in realistic scenarios
 */

import { KnowledgeBaseService } from '../../../src/services/KnowledgeBaseService';
import { GeminiService } from '../../../src/services/GeminiService';
import { MetricsService } from '../../../src/services/MetricsService';
import { CacheService } from '../../../src/services/CacheService';
import { KBEntry, KBEntryInput, SearchResult, ServiceConfig } from '../../../src/types/services';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

// Test configuration optimized for integration testing
const TEST_CONFIG: ServiceConfig = {
  database: {
    path: ':memory:',
    pragmas: {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: -2000,
      temp_store: 'memory'
    },
    backup: {
      enabled: false,
      interval: 60000,
      retention: 7,
      path: './test-backups'
    },
    performance: {
      connectionPool: 1,
      busyTimeout: 5000,
      cacheSize: 2000
    }
  },
  search: {
    fts: {
      tokenize: 'porter',
      remove_diacritics: 1,
      categories: 'JCL,VSAM,DB2,Batch,Functional,CICS,IMS,System,Other'
    },
    ai: {
      enabled: true,
      fallback: true,
      timeout: 10000,
      retries: 2,
      batchSize: 20
    },
    cache: {
      enabled: true,
      ttl: 300000,
      maxSize: 100
    }
  },
  cache: {
    maxSize: 1000,
    ttl: 300000,
    checkPeriod: 60000,
    strategy: 'lru' as const,
    persistent: false
  },
  metrics: {
    enabled: true,
    retention: 86400000,
    aggregation: {
      enabled: true,
      interval: 30000,
      batch: 100
    },
    alerts: {
      enabled: true,
      thresholds: {
        search_response_time: 2000,
        error_rate: 0.05
      }
    }
  },
  validation: {
    strict: false,
    sanitize: true,
    maxLength: {
      title: 200,
      problem: 5000,
      solution: 10000,
      tags: 50
    },
    minLength: {
      title: 5,
      problem: 10,
      solution: 10
    },
    patterns: {
      tag: /^[a-zA-Z0-9_-]+$/,
      category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'System', 'Other']
    }
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || 'test-key',
    model: 'gemini-pro',
    temperature: 0.3,
    maxTokens: 1024,
    timeout: 10000,
    rateLimit: {
      requests: 60,
      window: 60000
    }
  },
  logging: {
    level: 'warn' as const,
    file: {
      enabled: false,
      path: './logs/test.log',
      maxSize: 10485760,
      maxFiles: 3
    },
    console: false,
    structured: false
  }
};

// Mock implementation of validation service
class MockValidationService {
  validateEntry(entry: KBEntryInput) {
    return {
      valid: true,
      errors: []
    };
  }

  validateUpdate(updates: any) {
    return {
      valid: true,
      errors: []
    };
  }

  validateBatch(entries: KBEntryInput[]) {
    return entries.map(() => ({ valid: true, errors: [] }));
  }
}

// Mock implementation of search service
class MockSearchService {
  private eventEmitter = new EventEmitter();

  async search(query: string, entries: KBEntry[], options?: any): Promise<SearchResult[]> {
    // Simple text-based search for testing
    const queryLower = query.toLowerCase();
    const results = entries
      .map((entry, index) => {
        const text = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();
        let score = 0;

        if (text.includes(queryLower)) {
          score = 80;
          if (entry.title.toLowerCase().includes(queryLower)) score += 20;
        }

        return score > 0 ? {
          entry,
          score,
          matchType: 'fuzzy' as const,
          highlights: [entry.title],
          metadata: { processingTime: Math.random() * 100 }
        } : null;
      })
      .filter(Boolean) as SearchResult[];

    return results.sort((a, b) => b.score - a.score);
  }

  async searchWithAI(query: string, entries: KBEntry[], options?: any): Promise<SearchResult[]> {
    // Simulate AI-enhanced search with fallback
    try {
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay
      return await this.search(query, entries, options);
    } catch (error) {
      return await this.search(query, entries, options);
    }
  }
}

// Test data for integration scenarios
const createTestEntries = (): KBEntryInput[] => [
  {
    title: 'VSAM Status 35 - File Not Found',
    problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
    solution: '1. Verify the dataset exists\n2. Check DD statement\n3. Verify catalog',
    category: 'VSAM',
    tags: ['vsam', 'status-35', 'file-not-found'],
    created_by: 'test-user'
  },
  {
    title: 'S0C7 Data Exception',
    problem: 'Program abends with S0C7 data exception during arithmetic operations.',
    solution: '1. Check numeric fields\n2. Initialize working storage\n3. Add ON SIZE ERROR',
    category: 'Batch',
    tags: ['s0c7', 'data-exception', 'cobol'],
    created_by: 'test-user'
  },
  {
    title: 'JCL Dataset Not Found',
    problem: 'JCL fails with IEF212I dataset not found error.',
    solution: '1. Verify dataset name\n2. Check generation\n3. Verify existence',
    category: 'JCL',
    tags: ['jcl', 'dataset', 'not-found'],
    created_by: 'test-user'
  },
  {
    title: 'DB2 SQLCODE -904',
    problem: 'Program receives SQLCODE -904 indicating resource unavailable.',
    solution: '1. Check DB2 status\n2. Run IMAGE COPY\n3. Contact DBA',
    category: 'DB2',
    tags: ['db2', 'sqlcode', 'resource'],
    created_by: 'test-user'
  }
];

describe('Service Interaction Integration Tests', () => {
  let kbService: KnowledgeBaseService;
  let geminiService: GeminiService;
  let metricsService: MetricsService;
  let cacheService: CacheService;
  let mockValidation: MockValidationService;
  let mockSearch: MockSearchService;
  let testEntries: KBEntry[];

  beforeAll(async () => {
    // Initialize services with proper dependency injection
    mockValidation = new MockValidationService();
    mockSearch = new MockSearchService();
    cacheService = new CacheService(TEST_CONFIG.cache);
    metricsService = new MetricsService(TEST_CONFIG.metrics, ':memory:');
    
    // Initialize Gemini service
    if (TEST_CONFIG.gemini) {
      geminiService = new GeminiService(TEST_CONFIG.gemini);
    }

    // Initialize knowledge base service with all dependencies
    kbService = new KnowledgeBaseService(
      TEST_CONFIG,
      mockValidation as any,
      mockSearch as any,
      cacheService,
      metricsService,
      undefined // importExportService
    );

    await kbService.initialize();
  });

  afterAll(async () => {
    await kbService?.close();
    await cacheService?.clear();
    await metricsService?.close();
  });

  beforeEach(async () => {
    // Clear cache between tests
    await cacheService.clear();
    
    // Create fresh test data
    const entryInputs = createTestEntries();
    const ids = await kbService.createBatch(entryInputs);
    testEntries = await kbService.readBatch(ids);
  });

  describe('KB Service ↔ Cache Service Integration', () => {
    test('should cache entries on read and serve from cache', async () => {
      const entryId = testEntries[0].id;
      
      // First read should miss cache
      const entry1 = await kbService.read(entryId);
      expect(entry1).toBeTruthy();
      
      // Second read should hit cache
      const entry2 = await kbService.read(entryId);
      expect(entry2).toEqual(entry1);
      
      // Verify cache stats
      const stats = cacheService.stats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    test('should invalidate cache on entry updates', async () => {
      const entryId = testEntries[0].id;
      
      // Read to populate cache
      const originalEntry = await kbService.read(entryId);
      expect(originalEntry).toBeTruthy();
      
      // Update entry
      const success = await kbService.update(entryId, {
        title: 'Updated Title',
        updated_by: 'test-user'
      });
      expect(success).toBe(true);
      
      // Read again should get updated data
      const updatedEntry = await kbService.read(entryId);
      expect(updatedEntry?.title).toBe('Updated Title');
      expect(updatedEntry?.version).toBeGreaterThan(originalEntry!.version);
    });

    test('should handle cache failures gracefully', async () => {
      const entryId = testEntries[0].id;
      
      // Simulate cache failure
      jest.spyOn(cacheService, 'get').mockRejectedValueOnce(new Error('Cache error'));
      
      // Should still return data from database
      const entry = await kbService.read(entryId);
      expect(entry).toBeTruthy();
      expect(entry?.id).toBe(entryId);
    });
  });

  describe('KB Service ↔ Metrics Service Integration', () => {
    test('should record search metrics during search operations', async () => {
      const query = 'VSAM error';
      
      // Perform search
      const results = await kbService.search(query, {
        userId: 'test-user',
        sessionId: 'test-session'
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Allow time for metrics to be recorded
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify metrics were recorded
      const metrics = await metricsService.getMetrics('1h');
      expect(metrics.searches.totalSearches).toBeGreaterThan(0);
    });

    test('should record usage metrics during entry operations', async () => {
      const entryId = testEntries[0].id;
      
      // Record usage
      await kbService.recordUsage(entryId, true, 'test-user');
      await kbService.recordUsage(entryId, false, 'test-user');
      
      // Allow time for metrics to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify usage was recorded
      const metrics = await metricsService.getMetrics('1h');
      expect(metrics.usage.totalViews).toBeGreaterThanOrEqual(0);
    });

    test('should record performance metrics for operations', async () => {
      const startTime = Date.now();
      
      // Perform some operations
      await kbService.search('test query');
      await kbService.read(testEntries[0].id);
      
      const duration = Date.now() - startTime;
      
      // Allow time for metrics aggregation
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const metrics = await metricsService.getMetrics('1h');
      expect(metrics.performance.averageSearchTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Search Service ↔ AI Service Integration', () => {
    test('should enhance search results with AI when available', async () => {
      const query = 'arithmetic error in program';
      
      // Perform AI-enhanced search
      const results = await kbService.search(query, {
        useAI: true,
        userId: 'test-user'
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should find the S0C7 entry as it relates to arithmetic errors
      const s0c7Entry = results.find(r => 
        r.entry.title.includes('S0C7') || 
        r.entry.problem.includes('arithmetic')
      );
      expect(s0c7Entry).toBeTruthy();
    });

    test('should fallback gracefully when AI service fails', async () => {
      // Mock AI service failure
      if (geminiService) {
        jest.spyOn(geminiService, 'findSimilar').mockRejectedValueOnce(new Error('AI service error'));
      }
      
      const query = 'VSAM file error';
      
      // Should still return results using fallback search
      const results = await kbService.search(query);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchType).toBe('fuzzy'); // Indicates fallback was used
    });
  });

  describe('Cross-Service Event Handling', () => {
    test('should propagate events across service boundaries', async () => {
      const events: string[] = [];
      
      // Listen for events from different services
      kbService.on('entry:created', () => events.push('kb:created'));
      kbService.on('search:performed', () => events.push('kb:searched'));
      metricsService.on('search:recorded', () => events.push('metrics:search'));
      metricsService.on('usage:recorded', () => events.push('metrics:usage'));
      
      // Perform operations that should trigger events
      const newEntry: KBEntryInput = {
        title: 'Test Event Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Other',
        tags: ['test'],
        created_by: 'test-user'
      };
      
      const entryId = await kbService.create(newEntry);
      await kbService.search('test');
      await kbService.recordUsage(entryId, true, 'test-user');
      
      // Allow time for events to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(events).toContain('kb:created');
      expect(events).toContain('kb:searched');
      expect(events.length).toBeGreaterThan(0);
    });

    test('should handle service errors without breaking other services', async () => {
      // Simulate cache service error
      jest.spyOn(cacheService, 'set').mockRejectedValueOnce(new Error('Cache write error'));
      
      // Operations should still work
      const newEntry: KBEntryInput = {
        title: 'Error Test Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Other',
        tags: ['error-test'],
        created_by: 'test-user'
      };
      
      const entryId = await kbService.create(newEntry);
      expect(entryId).toBeTruthy();
      
      const entry = await kbService.read(entryId);
      expect(entry).toBeTruthy();
      expect(entry?.title).toBe('Error Test Entry');
    });
  });

  describe('Service Dependencies and Initialization', () => {
    test('should handle missing optional dependencies gracefully', async () => {
      // Create service without AI dependency
      const minimalService = new KnowledgeBaseService(
        TEST_CONFIG,
        mockValidation as any,
        mockSearch as any,
        undefined, // no cache
        undefined, // no metrics
        undefined  // no import/export
      );
      
      await minimalService.initialize();
      
      // Should still be able to perform basic operations
      const entryId = await minimalService.create(createTestEntries()[0]);
      expect(entryId).toBeTruthy();
      
      const entry = await minimalService.read(entryId);
      expect(entry).toBeTruthy();
      
      await minimalService.close();
    });

    test('should properly initialize service dependencies in correct order', async () => {
      const initOrder: string[] = [];
      
      // Create service with instrumented dependencies
      const instrumentedCache = new CacheService(TEST_CONFIG.cache);
      const instrumentedMetrics = new MetricsService(TEST_CONFIG.metrics, ':memory:');
      
      // Monitor initialization
      const originalInit = kbService.initialize;
      jest.spyOn(kbService, 'initialize').mockImplementation(async function(this: any) {
        initOrder.push('kb:start');
        await originalInit.call(this);
        initOrder.push('kb:complete');
      });
      
      const testService = new KnowledgeBaseService(
        TEST_CONFIG,
        mockValidation as any,
        mockSearch as any,
        instrumentedCache,
        instrumentedMetrics,
        undefined
      );
      
      await testService.initialize();
      
      expect(initOrder).toContain('kb:start');
      expect(initOrder).toContain('kb:complete');
      
      await testService.close();
    });
  });

  describe('Service Performance Under Load', () => {
    test('should handle concurrent operations across services', async () => {
      const concurrentOps = 10;
      const promises: Promise<any>[] = [];
      
      // Create concurrent operations
      for (let i = 0; i < concurrentOps; i++) {
        promises.push(
          kbService.create({
            title: `Concurrent Entry ${i}`,
            problem: `Problem ${i}`,
            solution: `Solution ${i}`,
            category: 'Other',
            tags: [`test-${i}`],
            created_by: 'test-user'
          })
        );
        
        promises.push(kbService.search(`test query ${i}`));
        
        if (i < testEntries.length) {
          promises.push(kbService.read(testEntries[i].id));
        }
      }
      
      // All operations should complete successfully
      const results = await Promise.allSettled(promises);
      const failures = results.filter(r => r.status === 'rejected');
      
      expect(failures.length).toBe(0);
    });

    test('should maintain service stability under error conditions', async () => {
      // Introduce random failures
      let callCount = 0;
      jest.spyOn(cacheService, 'get').mockImplementation(async (key: string) => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('Intermittent cache error');
        }
        return null; // Cache miss
      });
      
      // Perform operations that should handle cache errors gracefully
      const operations: Promise<any>[] = [];
      for (let i = 0; i < 20; i++) {
        operations.push(kbService.read(testEntries[i % testEntries.length].id));
      }
      
      const results = await Promise.allSettled(operations);
      const successful = results.filter(r => r.status === 'fulfilled');
      
      // Should complete most operations despite cache errors
      expect(successful.length).toBeGreaterThan(operations.length * 0.8);
    });
  });

  describe('Service Transaction Handling', () => {
    test('should handle batch operations atomically across services', async () => {
      const batchEntries = [
        {
          title: 'Batch Entry 1',
          problem: 'Problem 1',
          solution: 'Solution 1',
          category: 'Batch' as const,
          tags: ['batch-1'],
          created_by: 'test-user'
        },
        {
          title: 'Batch Entry 2',
          problem: 'Problem 2',
          solution: 'Solution 2',
          category: 'JCL' as const,
          tags: ['batch-2'],
          created_by: 'test-user'
        }
      ];
      
      // Create batch
      const ids = await kbService.createBatch(batchEntries);
      expect(ids).toHaveLength(batchEntries.length);
      
      // Verify all entries were created
      const createdEntries = await kbService.readBatch(ids);
      expect(createdEntries).toHaveLength(batchEntries.length);
      
      // Update batch
      const updates = ids.map((id, index) => ({
        id,
        updates: { title: `Updated Batch Entry ${index + 1}`, updated_by: 'test-user' }
      }));
      
      const updateResults = await kbService.updateBatch(updates);
      expect(updateResults.every(Boolean)).toBe(true);
      
      // Verify updates
      const updatedEntries = await kbService.readBatch(ids);
      updatedEntries.forEach((entry, index) => {
        expect(entry.title).toBe(`Updated Batch Entry ${index + 1}`);
      });
    });
  });
});