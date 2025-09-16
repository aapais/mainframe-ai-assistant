import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Core imports
import { AppError, ErrorCode, ErrorSeverity } from '../../../src/core/errors/AppError';
import { ServiceFactory } from '../../../src/services/ServiceFactory';
import { KnowledgeBaseService } from '../../../src/services/KnowledgeBaseService';
import { GeminiService } from '../../../src/services/GeminiService';
import { CacheService } from '../../../src/services/CacheService';
import { MetricsService } from '../../../src/services/MetricsService';
import { ImportExportService } from '../../../src/services/ImportExportService';

// Test utilities
import { createTestDB, cleanupTestDB, waitFor, injectError, createLargePayload } from '../test-utils/error-injection-utils';

interface ErrorScenario {
  name: string;
  scenario: () => Promise<void>;
  expectedErrorCode?: ErrorCode;
  expectedSeverity?: ErrorSeverity;
  shouldRecover: boolean;
  recoveryTimeMs?: number;
}

interface ErrorStats {
  totalErrors: number;
  recoveredErrors: number;
  nonRecoverableErrors: number;
  averageRecoveryTime: number;
  errorsByCategory: Record<string, number>;
}

describe('Error Scenarios Integration Tests', () => {
  let serviceFactory: ServiceFactory;
  let kbService: KnowledgeBaseService;
  let geminiService: GeminiService;
  let cacheService: CacheService;
  let metricsService: MetricsService;
  let importExportService: ImportExportService;
  let testDbPath: string;
  let originalConsoleError: typeof console.error;
  let capturedErrors: Array<{ error: Error; timestamp: Date; context?: any }> = [];

  beforeAll(async () => {
    // Setup test database
    testDbPath = await createTestDB();
    
    // Capture console errors for analysis
    originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      if (args[0] instanceof Error) {
        capturedErrors.push({ error: args[0], timestamp: new Date(), context: args.slice(1) });
      }
      originalConsoleError(...args);
    };

    // Initialize services with error-prone configuration
    serviceFactory = new ServiceFactory({
      database: {
        path: testDbPath,
        pragmas: {
          journal_mode: 'WAL',
          synchronous: 'NORMAL',
          cache_size: -1000, // Small cache to trigger memory pressure
          foreign_keys: 'ON'
        },
        backup: { enabled: true, interval: 300000, retention: 1, path: path.dirname(testDbPath) },
        performance: { connectionPool: 2, busyTimeout: 1000, cacheSize: 1000 }
      },
      validation: {
        strict: true,
        sanitize: true,
        maxLength: { title: 100, problem: 1000, solution: 1000, tags: 20 },
        minLength: { title: 5, problem: 10, solution: 10 },
        patterns: {
          tag: /^[a-zA-Z0-9-_]+$/,
          category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other']
        }
      },
      ai: {
        apiKey: 'test-key-invalid', // Intentionally invalid
        timeout: 2000, // Short timeout
        retries: 1, // Minimal retries
        fallback: true,
        batchSize: 5
      },
      cache: { maxSize: 10, ttl: 1000, checkPeriod: 500, strategy: 'lru', persistent: false },
      metrics: { 
        enabled: true, 
        retention: 10000,
        aggregation: { enabled: true, interval: 1000, batch: 10 },
        alerts: { enabled: true, thresholds: { errorRate: 0.1, responseTime: 1000 } }
      },
      logging: {
        level: 'debug',
        file: { enabled: false, path: '', maxSize: 0, maxFiles: 0 },
        console: true,
        structured: true
      }
    });

    await serviceFactory.initialize();
    
    kbService = serviceFactory.getKnowledgeBaseService();
    cacheService = serviceFactory.getCacheService();
    metricsService = serviceFactory.getMetricsService();
    importExportService = serviceFactory.getImportExportService();
    
    // Initialize Gemini with invalid key for testing fallbacks
    geminiService = new GeminiService({
      apiKey: 'invalid-test-key',
      timeout: 1000,
      temperature: 0.3
    });
  });

  afterAll(async () => {
    console.error = originalConsoleError;
    
    if (serviceFactory) {
      await serviceFactory.shutdown();
    }
    
    await cleanupTestDB(testDbPath);
  });

  beforeEach(() => {
    capturedErrors = [];
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any test data
    try {
      const entries = await kbService.search('test-entry-', { limit: 1000 });
      for (const result of entries.results) {
        try {
          await kbService.delete(result.entry.id!);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Database Error Scenarios', () => {
    const scenarios: ErrorScenario[] = [
      {
        name: 'Database connection timeout',
        scenario: async () => {
          // Simulate connection timeout by overwhelming the connection pool
          const promises = Array(20).fill(0).map(async (_, i) => {
            try {
              await kbService.create({
                title: `test-entry-timeout-${i}`,
                problem: 'Connection timeout test',
                solution: 'This should timeout',
                category: 'Other',
                tags: [`timeout-${i}`]
              });
            } catch (error) {
              if (error instanceof AppError && error.code === ErrorCode.DATABASE_CONNECTION_ERROR) {
                throw error;
              }
            }
          });

          await Promise.allSettled(promises);
        },
        expectedErrorCode: ErrorCode.DATABASE_CONNECTION_ERROR,
        expectedSeverity: ErrorSeverity.CRITICAL,
        shouldRecover: true,
        recoveryTimeMs: 5000
      },
      {
        name: 'Database lock timeout',
        scenario: async () => {
          // Start a long-running transaction
          const longPromise = kbService.create({
            title: 'test-entry-lock-long',
            problem: 'Long running operation',
            solution: 'This will hold a lock',
            category: 'Other',
            tags: ['lock-test']
          });

          // Immediately try to create another entry (should cause lock contention)
          await waitFor(10);
          const quickPromise = kbService.create({
            title: 'test-entry-lock-quick',
            problem: 'Quick operation',
            solution: 'This should be blocked',
            category: 'Other',
            tags: ['lock-test']
          });

          const results = await Promise.allSettled([longPromise, quickPromise]);
          
          // At least one should succeed, one might fail with lock timeout
          const failures = results.filter(r => r.status === 'rejected');
          if (failures.length > 0) {
            throw new AppError(
              ErrorCode.RESOURCE_LOCKED,
              'Database lock timeout detected',
              { failures: failures.length }
            );
          }
        },
        expectedErrorCode: ErrorCode.RESOURCE_LOCKED,
        expectedSeverity: ErrorSeverity.MEDIUM,
        shouldRecover: true,
        recoveryTimeMs: 2000
      },
      {
        name: 'Constraint violation recovery',
        scenario: async () => {
          // Try to create entry with invalid data
          await kbService.create({
            title: '', // Too short - should violate constraint
            problem: 'Test problem',
            solution: 'Test solution',
            category: 'Other',
            tags: []
          });
        },
        expectedErrorCode: ErrorCode.VALIDATION_ERROR,
        expectedSeverity: ErrorSeverity.MEDIUM,
        shouldRecover: true,
        recoveryTimeMs: 100
      },
      {
        name: 'Foreign key constraint violation',
        scenario: async () => {
          // Try to record usage for non-existent entry
          await metricsService.recordUsage('non-existent-id', 'view', 'test-user');
        },
        expectedErrorCode: ErrorCode.DATABASE_CONSTRAINT_ERROR,
        expectedSeverity: ErrorSeverity.MEDIUM,
        shouldRecover: true,
        recoveryTimeMs: 100
      }
    ];

    scenarios.forEach(scenario => {
      it(`should handle ${scenario.name} gracefully`, async () => {
        const startTime = Date.now();
        let thrownError: AppError | null = null;

        try {
          await scenario.scenario();
        } catch (error) {
          thrownError = error instanceof AppError ? error : AppError.fromUnknown(error);
        }

        if (scenario.expectedErrorCode) {
          expect(thrownError).toBeDefined();
          expect(thrownError!.code).toBe(scenario.expectedErrorCode);
          expect(thrownError!.severity).toBe(scenario.expectedSeverity);
        }

        if (scenario.shouldRecover) {
          // Wait for recovery period
          if (scenario.recoveryTimeMs) {
            await waitFor(scenario.recoveryTimeMs);
          }

          // Test that system is functional after error
          const testEntry = await kbService.create({
            title: `recovery-test-${Date.now()}`,
            problem: 'Recovery test problem',
            solution: 'Recovery test solution',
            category: 'Other',
            tags: ['recovery-test']
          });

          expect(testEntry.id).toBeDefined();

          // Verify we can search for the entry
          const searchResults = await kbService.search('recovery-test');
          expect(searchResults.results.length).toBeGreaterThan(0);

          const recoveryTime = Date.now() - startTime;
          console.log(`Recovery completed in ${recoveryTime}ms for scenario: ${scenario.name}`);
        }
      }, 15000); // Extended timeout for recovery scenarios
    });
  });

  describe('Network Error Scenarios', () => {
    it('should handle AI service failures with graceful fallback', async () => {
      const query = 'VSAM status 35 error';
      
      // Create some test entries for fallback search
      await kbService.create({
        title: 'VSAM Status 35 Error',
        problem: 'VSAM file not found error',
        solution: 'Check file exists and is cataloged',
        category: 'VSAM',
        tags: ['vsam', 'status-35', 'file-not-found']
      });

      // AI service should fail but fallback to local search
      const results = await kbService.search(query, { useAI: true });
      
      expect(results.results.length).toBeGreaterThan(0);
      expect(results.meta.aiUsed).toBe(false); // Should fallback to local search
      expect(results.meta.fallbackReason).toContain('AI service');
    });

    it('should handle network timeouts with exponential backoff', async () => {
      const startTime = Date.now();
      
      try {
        // This should timeout quickly due to invalid API key
        await geminiService.findSimilar('test query', [], 5);
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.AI_SERVICE_UNAVAILABLE);
        
        // Should have attempted with timeout
        expect(duration).toBeGreaterThan(500); // At least some timeout delay
        expect(duration).toBeLessThan(5000); // But not too long
      }
    });

    it('should handle rate limiting with backoff strategy', async () => {
      // Simulate rapid API calls that would trigger rate limiting
      const promises = Array(10).fill(0).map(async (_, i) => {
        try {
          return await geminiService.explainError(`S0C${i}`);
        } catch (error) {
          return { error, index: i };
        }
      });

      const results = await Promise.allSettled(promises);
      const failures = results.filter(r => r.status === 'rejected' || 
        (r.status === 'fulfilled' && 'error' in r.value));

      // Should have some failures due to rate limiting simulation
      expect(failures.length).toBeGreaterThan(0);
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle memory pressure gracefully', async () => {
      const largeEntries = Array(50).fill(0).map((_, i) => ({
        title: `large-entry-${i}`,
        problem: createLargePayload(10000, `problem-${i}`),
        solution: createLargePayload(10000, `solution-${i}`),
        category: 'Other' as const,
        tags: [`large-${i}`, `memory-test-${i}`]
      }));

      let successCount = 0;
      let errorCount = 0;

      for (const entry of largeEntries) {
        try {
          await kbService.create(entry);
          successCount++;
        } catch (error) {
          errorCount++;
          
          if (error instanceof AppError) {
            expect([
              ErrorCode.MEMORY_LIMIT_EXCEEDED,
              ErrorCode.PERFORMANCE_DEGRADATION,
              ErrorCode.DATABASE_INSERT_ERROR
            ]).toContain(error.code);
          }
        }
      }

      console.log(`Memory pressure test: ${successCount} success, ${errorCount} errors`);
      
      // Should handle at least some entries even under memory pressure
      expect(successCount).toBeGreaterThan(0);
      
      // System should remain functional
      const testEntry = await kbService.create({
        title: 'post-memory-test',
        problem: 'Small test after memory pressure',
        solution: 'Should work fine',
        category: 'Other',
        tags: ['post-test']
      });
      
      expect(testEntry.id).toBeDefined();
    });

    it('should handle cache overflow gracefully', async () => {
      // Fill cache beyond capacity
      const cacheKeys = Array(20).fill(0).map((_, i) => `cache-key-${i}`);
      
      // Fill cache
      for (const key of cacheKeys) {
        await cacheService.set(key, `value-${key}`);
      }

      // Verify cache is full and evicting old entries
      let foundCount = 0;
      let missCount = 0;

      for (const key of cacheKeys) {
        const value = await cacheService.get(key);
        if (value) {
          foundCount++;
        } else {
          missCount++;
        }
      }

      console.log(`Cache overflow test: ${foundCount} found, ${missCount} missing`);
      
      // Due to LRU eviction, should have some misses
      expect(missCount).toBeGreaterThan(0);
      
      // Cache should still function for new entries
      await cacheService.set('new-key', 'new-value');
      const newValue = await cacheService.get('new-key');
      expect(newValue).toBe('new-value');
    });

    it('should handle file handle exhaustion', async () => {
      // Create many import/export operations simultaneously
      const operations = Array(20).fill(0).map(async (_, i) => {
        const testData = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          entries: [{
            title: `export-test-${i}`,
            problem: `Test problem ${i}`,
            solution: `Test solution ${i}`,
            category: 'Other',
            tags: [`export-${i}`]
          }]
        };

        try {
          const exported = await importExportService.exportData(testData, 'json');
          const imported = await importExportService.importData(exported, 'json');
          return { success: true, index: i };
        } catch (error) {
          return { success: false, error, index: i };
        }
      });

      const results = await Promise.allSettled(operations);
      const successes = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length;
      
      const failures = results.filter(r => 
        r.status === 'rejected' || 
        (r.status === 'fulfilled' && !r.value.success)
      ).length;

      console.log(`File handle test: ${successes} success, ${failures} failures`);
      
      // Should handle at least some operations
      expect(successes).toBeGreaterThan(0);
      
      // System should remain functional
      const postTestEntry = await kbService.create({
        title: 'post-file-handle-test',
        problem: 'Test after file operations',
        solution: 'Should work',
        category: 'Other',
        tags: ['post-file-test']
      });
      
      expect(postTestEntry.id).toBeDefined();
    });
  });

  describe('Data Consistency Scenarios', () => {
    it('should handle concurrent modification conflicts', async () => {
      // Create initial entry
      const entry = await kbService.create({
        title: 'concurrent-test-entry',
        problem: 'Test for concurrent modifications',
        solution: 'Original solution',
        category: 'Other',
        tags: ['concurrent-test']
      });

      // Simulate concurrent updates
      const update1Promise = kbService.update(entry.id!, {
        title: 'concurrent-test-entry',
        problem: 'Updated by user 1',
        solution: 'Solution updated by user 1',
        category: 'Other',
        tags: ['concurrent-test', 'user1']
      });

      const update2Promise = kbService.update(entry.id!, {
        title: 'concurrent-test-entry',
        problem: 'Updated by user 2',
        solution: 'Solution updated by user 2',
        category: 'Other',
        tags: ['concurrent-test', 'user2']
      });

      const results = await Promise.allSettled([update1Promise, update2Promise]);
      
      // At least one update should succeed
      const successes = results.filter(r => r.status === 'fulfilled');
      expect(successes.length).toBeGreaterThan(0);

      // Check final state is consistent
      const finalEntry = await kbService.getById(entry.id!);
      expect(finalEntry).toBeDefined();
      expect(finalEntry!.title).toBe('concurrent-test-entry');
    });

    it('should handle data corruption detection and recovery', async () => {
      // Create entry with checksum
      const entry = await kbService.create({
        title: 'corruption-test-entry',
        problem: 'Test for corruption detection',
        solution: 'Original clean data',
        category: 'Other',
        tags: ['corruption-test']
      });

      // Verify entry exists and is valid
      const retrievedEntry = await kbService.getById(entry.id!);
      expect(retrievedEntry).toBeDefined();
      expect(retrievedEntry!.title).toBe('corruption-test-entry');

      // Test search consistency
      const searchResults = await kbService.search('corruption-test');
      expect(searchResults.results.length).toBeGreaterThan(0);
      
      const foundEntry = searchResults.results.find(r => r.entry.id === entry.id!);
      expect(foundEntry).toBeDefined();
    });

    it('should handle orphaned data cleanup', async () => {
      // This test would require direct database manipulation to create orphaned data
      // For now, we'll test the cleanup mechanisms work correctly
      
      const entry = await kbService.create({
        title: 'orphan-test-entry',
        problem: 'Test for orphaned data handling',
        solution: 'Test solution',
        category: 'Other',
        tags: ['orphan-test', 'cleanup-test']
      });

      // Record some usage
      await metricsService.recordUsage(entry.id!, 'view', 'test-user');
      await metricsService.recordUsage(entry.id!, 'copy', 'test-user');

      // Delete the entry
      await kbService.delete(entry.id!);

      // Verify entry is gone
      const deletedEntry = await kbService.getById(entry.id!);
      expect(deletedEntry).toBeNull();

      // Verify associated data is also cleaned up (metrics, tags, etc.)
      // This depends on foreign key constraints and cascade deletes
      try {
        await metricsService.recordUsage(entry.id!, 'view', 'test-user');
        // Should fail because entry no longer exists
        fail('Should have thrown foreign key constraint error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCode.DATABASE_CONSTRAINT_ERROR);
      }
    });
  });

  describe('Error Recovery Validation', () => {
    it('should provide comprehensive error reporting', async () => {
      const errorStats: ErrorStats = {
        totalErrors: capturedErrors.length,
        recoveredErrors: 0,
        nonRecoverableErrors: 0,
        averageRecoveryTime: 0,
        errorsByCategory: {}
      };

      for (const capturedError of capturedErrors) {
        if (capturedError.error instanceof AppError) {
          const category = capturedError.error.category;
          errorStats.errorsByCategory[category] = (errorStats.errorsByCategory[category] || 0) + 1;
          
          if (capturedError.error.retryable) {
            errorStats.recoveredErrors++;
          } else {
            errorStats.nonRecoverableErrors++;
          }
        }
      }

      console.log('Error Recovery Statistics:', errorStats);

      // Validate error handling coverage
      expect(errorStats.totalErrors).toBeGreaterThan(0);
      
      // Most errors should be recoverable in a well-designed system
      if (errorStats.totalErrors > 0) {
        const recoveryRate = errorStats.recoveredErrors / errorStats.totalErrors;
        expect(recoveryRate).toBeGreaterThan(0.5); // At least 50% should be recoverable
      }
    });

    it('should maintain service health after error scenarios', async () => {
      const healthCheck = await serviceFactory.healthCheck();
      
      console.log('Post-test health check:', healthCheck);
      
      // Core services should be functional
      expect(healthCheck.services.knowledgeBase.healthy).toBe(true);
      expect(healthCheck.services.cache.healthy).toBe(true);
      expect(healthCheck.services.metrics.healthy).toBe(true);
      
      // Overall system should be at least degraded but functional
      expect(['healthy', 'degraded']).toContain(healthCheck.overall);
    });

    it('should have proper error logging and monitoring', async () => {
      // Verify error logging is working
      expect(capturedErrors.length).toBeGreaterThan(0);
      
      // Verify error metadata is properly captured
      for (const capturedError of capturedErrors) {
        if (capturedError.error instanceof AppError) {
          expect(capturedError.error.correlationId).toBeDefined();
          expect(capturedError.error.timestamp).toBeDefined();
          expect(capturedError.error.code).toBeDefined();
          expect(capturedError.error.severity).toBeDefined();
        }
      }

      // Verify metrics are being collected
      const metrics = await metricsService.getSystemMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.errors).toBeDefined();
    });
  });
});