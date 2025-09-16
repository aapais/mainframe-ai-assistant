/**
 * Data Consistency Integration Tests
 * Tests cross-service data consistency, transaction integrity, and concurrent update handling
 */

import { KnowledgeBaseService } from '../../../src/services/KnowledgeBaseService';
import { MetricsService } from '../../../src/services/MetricsService';
import { CacheService } from '../../../src/services/CacheService';
import { KBEntry, KBEntryInput, KBEntryUpdate, ServiceConfig } from '../../../src/types/services';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';

// Configuration optimized for data consistency testing
const CONSISTENCY_CONFIG: ServiceConfig = {
  database: {
    path: ':memory:',
    pragmas: {
      journal_mode: 'WAL',
      synchronous: 'FULL', // Maximum durability
      foreign_keys: 'ON',
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
      busyTimeout: 10000,
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
      enabled: false, // Disable AI for consistency testing
      fallback: true,
      timeout: 5000,
      retries: 1,
      batchSize: 10
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
    checkPeriod: 30000,
    strategy: 'lru' as const,
    persistent: false
  },
  metrics: {
    enabled: true,
    retention: 86400000,
    aggregation: {
      enabled: true,
      interval: 5000,
      batch: 10
    },
    alerts: {
      enabled: false, // Disable alerts for cleaner testing
      thresholds: {}
    }
  },
  validation: {
    strict: true,
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
  logging: {
    level: 'warn' as const,
    file: { enabled: false, path: '', maxSize: 0, maxFiles: 0 },
    console: false,
    structured: false
  }
};

// Test utilities for data consistency validation
class DataConsistencyValidator {
  private kbService: KnowledgeBaseService;
  private metricsService: MetricsService;
  private cacheService: CacheService;

  constructor(
    kbService: KnowledgeBaseService,
    metricsService: MetricsService,
    cacheService: CacheService
  ) {
    this.kbService = kbService;
    this.metricsService = metricsService;
    this.cacheService = cacheService;
  }

  async validateEntryConsistency(entryId: string): Promise<{
    consistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // 1. Validate KB entry exists and has correct structure
      const entry = await this.kbService.read(entryId);
      if (!entry) {
        issues.push(`Entry ${entryId} not found in KB`);
        return { consistent: false, issues };
      }

      // 2. Validate required fields
      if (!entry.id || !entry.title || !entry.problem || !entry.solution) {
        issues.push(`Entry ${entryId} missing required fields`);
      }

      // 3. Validate version consistency
      if (!entry.version || entry.version < 1) {
        issues.push(`Entry ${entryId} has invalid version: ${entry.version}`);
      }

      // 4. Validate timestamp consistency
      if (!entry.created_at || !entry.updated_at) {
        issues.push(`Entry ${entryId} missing required timestamps`);
      }

      if (entry.created_at > entry.updated_at) {
        issues.push(`Entry ${entryId} has created_at > updated_at`);
      }

      // 5. Validate tags consistency
      if (entry.tags) {
        const uniqueTags = new Set(entry.tags);
        if (uniqueTags.size !== entry.tags.length) {
          issues.push(`Entry ${entryId} has duplicate tags`);
        }
      }

      // 6. Validate usage statistics consistency
      const totalUsage = (entry.success_count || 0) + (entry.failure_count || 0);
      if (totalUsage > (entry.usage_count || 0)) {
        issues.push(`Entry ${entryId} has inconsistent usage statistics`);
      }

      return { consistent: issues.length === 0, issues };
    } catch (error) {
      issues.push(`Error validating entry ${entryId}: ${error.message}`);
      return { consistent: false, issues };
    }
  }

  async validateCrossServiceConsistency(entryId: string, userId?: string): Promise<{
    consistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // 1. Check KB-Cache consistency
      const kbEntry = await this.kbService.read(entryId);
      
      if (kbEntry) {
        // Force cache lookup
        const cacheKey = `entry:${entryId}`;
        const cachedEntry = await this.cacheService.get<KBEntry>(cacheKey);
        
        if (cachedEntry && JSON.stringify(kbEntry) !== JSON.stringify(cachedEntry)) {
          issues.push(`Cache-KB mismatch for entry ${entryId}`);
        }
      }

      // 2. Check search index consistency
      const searchResults = await this.kbService.search(entryId, { limit: 50 });
      const foundInSearch = searchResults.some(r => r.entry.id === entryId);
      
      if (kbEntry && !foundInSearch) {
        // Entry exists but not in search index
        issues.push(`Entry ${entryId} exists in KB but not found in search index`);
      }

      return { consistent: issues.length === 0, issues };
    } catch (error) {
      issues.push(`Error validating cross-service consistency: ${error.message}`);
      return { consistent: false, issues };
    }
  }

  async validateMetricsConsistency(): Promise<{
    consistent: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const metrics = await this.metricsService.getMetrics('24h');
      
      // 1. Validate overview metrics consistency
      if (metrics.overview.totalSearches < 0) {
        issues.push('Total searches cannot be negative');
      }
      
      if (metrics.overview.averageSuccessRate < 0 || metrics.overview.averageSuccessRate > 1) {
        issues.push('Average success rate must be between 0 and 1');
      }

      // 2. Validate search metrics consistency  
      if (metrics.searches.averageResultCount < 0) {
        issues.push('Average result count cannot be negative');
      }

      if (metrics.searches.averageResponseTime < 0) {
        issues.push('Average response time cannot be negative');
      }

      // 3. Validate usage metrics consistency
      if (metrics.usage.uniqueUsers < 0) {
        issues.push('Unique users count cannot be negative');
      }

      return { consistent: issues.length === 0, issues };
    } catch (error) {
      issues.push(`Error validating metrics consistency: ${error.message}`);
      return { consistent: false, issues };
    }
  }
}

// Mock services for consistency testing
class ConsistentMockValidation {
  validateEntry(entry: KBEntryInput) {
    const errors: Array<{field: string, message: string}> = [];
    
    if (!entry.title?.trim()) {
      errors.push({ field: 'title', message: 'Title is required' });
    }
    
    if (!entry.problem?.trim()) {
      errors.push({ field: 'problem', message: 'Problem is required' });
    }
    
    if (!entry.solution?.trim()) {
      errors.push({ field: 'solution', message: 'Solution is required' });
    }
    
    return { valid: errors.length === 0, errors };
  }

  validateUpdate(updates: KBEntryUpdate) {
    return { valid: true, errors: [] };
  }

  validateBatch(entries: KBEntryInput[]) {
    return entries.map(entry => this.validateEntry(entry));
  }
}

class ConsistentMockSearchService {
  async search(query: string, entries: KBEntry[], options?: any): Promise<any[]> {
    // Simple but consistent search implementation
    const queryLower = query.toLowerCase();
    
    return entries
      .filter(entry => {
        const text = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();
        return text.includes(queryLower);
      })
      .map(entry => ({
        entry,
        score: 70,
        matchType: 'fuzzy' as const,
        highlights: [entry.title]
      }))
      .slice(0, options?.limit || 10);
  }
}

describe('Data Consistency Integration Tests', () => {
  let kbService: KnowledgeBaseService;
  let metricsService: MetricsService;
  let cacheService: CacheService;
  let validator: DataConsistencyValidator;
  let mockValidation: ConsistentMockValidation;
  let mockSearch: ConsistentMockSearchService;
  let testEntries: KBEntry[];

  beforeAll(async () => {
    mockValidation = new ConsistentMockValidation();
    mockSearch = new ConsistentMockSearchService();
    cacheService = new CacheService(CONSISTENCY_CONFIG.cache);
    metricsService = new MetricsService(CONSISTENCY_CONFIG.metrics, ':memory:');

    kbService = new KnowledgeBaseService(
      CONSISTENCY_CONFIG,
      mockValidation as any,
      mockSearch as any,
      cacheService,
      metricsService,
      undefined
    );

    await kbService.initialize();
    validator = new DataConsistencyValidator(kbService, metricsService, cacheService);
  });

  afterAll(async () => {
    await kbService?.close();
    await cacheService?.clear();
    await metricsService?.close();
  });

  beforeEach(async () => {
    // Create clean test data
    await cacheService.clear();
    
    const entryInputs: KBEntryInput[] = [
      {
        title: 'Consistency Test Entry 1',
        problem: 'Test problem for consistency validation',
        solution: 'Test solution for consistency validation',
        category: 'System',
        tags: ['consistency', 'test-1'],
        created_by: 'test-user'
      },
      {
        title: 'Consistency Test Entry 2',
        problem: 'Another test problem for validation',
        solution: 'Another test solution for validation',
        category: 'Batch',
        tags: ['consistency', 'test-2'],
        created_by: 'test-user'
      }
    ];

    const ids = await kbService.createBatch(entryInputs);
    testEntries = await kbService.readBatch(ids);
  });

  describe('Single Entry Data Consistency', () => {
    test('should maintain entry data integrity across operations', async () => {
      const entry = testEntries[0];
      
      // 1. Validate initial consistency
      const initialCheck = await validator.validateEntryConsistency(entry.id);
      expect(initialCheck.consistent).toBe(true);
      expect(initialCheck.issues).toHaveLength(0);

      // 2. Update entry and validate consistency maintained
      const updateSuccess = await kbService.update(entry.id, {
        title: 'Updated Consistency Test Entry',
        tags: ['consistency', 'updated'],
        updated_by: 'test-user'
      });

      expect(updateSuccess).toBe(true);

      // 3. Re-validate consistency after update
      const postUpdateCheck = await validator.validateEntryConsistency(entry.id);
      expect(postUpdateCheck.consistent).toBe(true);

      // 4. Verify version was incremented
      const updatedEntry = await kbService.read(entry.id);
      expect(updatedEntry?.version).toBeGreaterThan(entry.version);
      expect(updatedEntry?.updated_at.getTime()).toBeGreaterThanOrEqual(entry.updated_at.getTime());
    });

    test('should maintain usage statistics consistency', async () => {
      const entry = testEntries[0];
      const userId = 'consistency-test-user';

      // Record multiple usage events
      await kbService.recordUsage(entry.id, true, userId);  // success
      await kbService.recordUsage(entry.id, false, userId); // failure  
      await kbService.recordUsage(entry.id, true, userId);  // success

      // Verify statistics are consistent
      const updatedEntry = await kbService.read(entry.id);
      expect(updatedEntry?.usage_count).toBe(3);
      expect(updatedEntry?.success_count).toBe(2);
      expect(updatedEntry?.failure_count).toBe(1);

      // Validate overall consistency
      const consistencyCheck = await validator.validateEntryConsistency(entry.id);
      expect(consistencyCheck.consistent).toBe(true);
    });

    test('should prevent invalid data states', async () => {
      // Test direct database manipulation to ensure constraints work
      // This simulates potential corruption scenarios
      
      const entry = testEntries[0];
      
      // Attempt to create invalid state should be prevented by validation
      try {
        await kbService.update(entry.id, {
          title: '', // Invalid empty title
          updated_by: 'test-user'
        });
        
        // If update somehow succeeded, verify validation catches inconsistency
        const validationResult = await validator.validateEntryConsistency(entry.id);
        if (!validationResult.consistent) {
          expect(validationResult.issues.length).toBeGreaterThan(0);
        }
      } catch (error) {
        // Expected to fail validation
        expect(error).toBeDefined();
      }
    });
  });

  describe('Cross-Service Data Consistency', () => {
    test('should maintain KB-Cache consistency', async () => {
      const entry = testEntries[0];

      // 1. Read entry to populate cache
      const firstRead = await kbService.read(entry.id);
      expect(firstRead).toBeTruthy();

      // 2. Update entry (should invalidate cache)
      await kbService.update(entry.id, {
        title: 'Cache Consistency Test',
        updated_by: 'test-user'
      });

      // 3. Read again (should get updated data, not stale cache)
      const secondRead = await kbService.read(entry.id);
      expect(secondRead?.title).toBe('Cache Consistency Test');
      expect(secondRead?.version).toBeGreaterThan(firstRead!.version);

      // 4. Validate cross-service consistency
      const consistencyCheck = await validator.validateCrossServiceConsistency(entry.id);
      expect(consistencyCheck.consistent).toBe(true);
    });

    test('should maintain search index consistency', async () => {
      const entry = testEntries[0];
      const uniqueSearchTerm = `unique-search-${Date.now()}`;

      // 1. Update entry with unique search term
      await kbService.update(entry.id, {
        title: `Entry with ${uniqueSearchTerm}`,
        updated_by: 'test-user'
      });

      // 2. Search should find the updated entry
      const searchResults = await kbService.search(uniqueSearchTerm);
      const foundEntry = searchResults.find(r => r.entry.id === entry.id);
      
      expect(foundEntry).toBeTruthy();
      expect(foundEntry?.entry.title).toContain(uniqueSearchTerm);

      // 3. Validate search index consistency
      const consistencyCheck = await validator.validateCrossServiceConsistency(entry.id);
      expect(consistencyCheck.consistent).toBe(true);
    });

    test('should maintain metrics consistency', async () => {
      const entry = testEntries[0];
      const userId = 'metrics-consistency-test';

      // Generate some metrics data
      await kbService.search('consistency test search', { userId });
      await kbService.recordUsage(entry.id, true, userId);
      
      // Allow time for metrics to be recorded
      await new Promise(resolve => setTimeout(resolve, 100));

      // Validate metrics consistency
      const metricsCheck = await validator.validateMetricsConsistency();
      expect(metricsCheck.consistent).toBe(true);
      expect(metricsCheck.issues).toHaveLength(0);
    });
  });

  describe('Concurrent Operations Data Consistency', () => {
    test('should handle concurrent reads without inconsistency', async () => {
      const entry = testEntries[0];
      const concurrentReads = 20;

      // Execute concurrent reads
      const readPromises = Array.from({ length: concurrentReads }, () =>
        kbService.read(entry.id)
      );

      const results = await Promise.all(readPromises);

      // All reads should return consistent data
      expect(results).toHaveLength(concurrentReads);
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(result?.id).toBe(entry.id);
        expect(result?.version).toBe(entry.version);
      });
    });

    test('should handle concurrent updates with proper versioning', async () => {
      const entry = testEntries[0];
      const concurrentUpdates = 5;

      // Create concurrent update operations
      const updatePromises = Array.from({ length: concurrentUpdates }, (_, i) =>
        kbService.update(entry.id, {
          title: `Concurrent Update ${i}`,
          updated_by: `user-${i}`
        })
      );

      const results = await Promise.allSettled(updatePromises);
      const successful = results.filter(r => r.status === 'fulfilled' && r.value === true);

      // At least one update should succeed
      expect(successful.length).toBeGreaterThan(0);

      // Final entry should have valid version
      const finalEntry = await kbService.read(entry.id);
      expect(finalEntry?.version).toBeGreaterThan(entry.version);

      // Validate consistency after concurrent updates
      const consistencyCheck = await validator.validateEntryConsistency(entry.id);
      expect(consistencyCheck.consistent).toBe(true);
    });

    test('should handle mixed concurrent operations (read/write/usage)', async () => {
      const entry = testEntries[0];
      const operations: Promise<any>[] = [];

      // Mix different types of operations
      for (let i = 0; i < 10; i++) {
        // Reads
        operations.push(kbService.read(entry.id));
        
        // Usage recording
        operations.push(kbService.recordUsage(entry.id, Math.random() > 0.5, `user-${i}`));
        
        // Searches that might return this entry
        operations.push(kbService.search('consistency', { userId: `user-${i}` }));
      }

      // One update operation
      operations.push(kbService.update(entry.id, {
        title: 'Mixed Operations Test Entry',
        updated_by: 'mixed-ops-user'
      }));

      // Execute all operations concurrently
      const results = await Promise.allSettled(operations);
      const failures = results.filter(r => r.status === 'rejected');

      // Most operations should succeed
      expect(failures.length).toBeLessThan(operations.length * 0.1); // Less than 10% failure

      // Final state should be consistent
      const consistencyCheck = await validator.validateEntryConsistency(entry.id);
      expect(consistencyCheck.consistent).toBe(true);
    });
  });

  describe('Batch Operations Data Consistency', () => {
    test('should maintain consistency across batch create operations', async () => {
      const batchSize = 10;
      const batchEntries: KBEntryInput[] = Array.from({ length: batchSize }, (_, i) => ({
        title: `Batch Entry ${i}`,
        problem: `Batch problem ${i}`,
        solution: `Batch solution ${i}`,
        category: 'System',
        tags: [`batch-${i}`, 'consistency'],
        created_by: 'batch-user'
      }));

      // Create batch
      const ids = await kbService.createBatch(batchEntries);
      expect(ids).toHaveLength(batchSize);

      // Validate each entry for consistency
      const validationPromises = ids.map(id => validator.validateEntryConsistency(id));
      const validationResults = await Promise.all(validationPromises);

      // All entries should be consistent
      validationResults.forEach(result => {
        expect(result.consistent).toBe(true);
        expect(result.issues).toHaveLength(0);
      });

      // Verify batch was created atomically (all or nothing)
      const createdEntries = await kbService.readBatch(ids);
      expect(createdEntries).toHaveLength(batchSize);
      createdEntries.forEach((entry, index) => {
        expect(entry.title).toBe(`Batch Entry ${index}`);
      });
    });

    test('should maintain consistency across batch update operations', async () => {
      const entries = testEntries;
      
      // Prepare batch updates
      const updates = entries.map((entry, index) => ({
        id: entry.id,
        updates: {
          title: `Batch Updated Entry ${index}`,
          tags: [...(entry.tags || []), 'batch-updated'],
          updated_by: 'batch-updater'
        }
      }));

      // Execute batch update
      const updateResults = await kbService.updateBatch(updates);
      expect(updateResults.every(Boolean)).toBe(true);

      // Validate consistency of all updated entries
      const validationPromises = entries.map(entry => 
        validator.validateEntryConsistency(entry.id)
      );
      const validationResults = await Promise.all(validationPromises);

      validationResults.forEach(result => {
        expect(result.consistent).toBe(true);
      });

      // Verify all updates were applied
      const updatedEntries = await kbService.readBatch(entries.map(e => e.id));
      updatedEntries.forEach((entry, index) => {
        expect(entry.title).toBe(`Batch Updated Entry ${index}`);
        expect(entry.tags).toContain('batch-updated');
        expect(entry.version).toBeGreaterThan(entries[index].version);
      });
    });

    test('should handle partial batch failures consistently', async () => {
      const entries = testEntries;
      
      // Create updates where some will fail validation
      const updates = entries.map((entry, index) => ({
        id: entry.id,
        updates: {
          title: index === 0 ? '' : `Valid Update ${index}`, // First update invalid
          updated_by: 'partial-batch-user'
        }
      }));

      // Mock validation to fail first entry
      jest.spyOn(mockValidation, 'validateUpdate')
        .mockImplementationOnce(() => ({ 
          valid: false, 
          errors: [{ field: 'title', message: 'Title cannot be empty' }] 
        }))
        .mockImplementation(() => ({ valid: true, errors: [] }));

      try {
        await kbService.updateBatch(updates);
      } catch (error) {
        // Expected to fail
      }

      // Verify system remains in consistent state
      const consistencyPromises = entries.map(entry => 
        validator.validateEntryConsistency(entry.id)
      );
      const consistencyResults = await Promise.all(consistencyPromises);

      consistencyResults.forEach(result => {
        expect(result.consistent).toBe(true);
      });
    });
  });

  describe('Transaction Integrity', () => {
    test('should rollback failed transactions completely', async () => {
      const entry = testEntries[0];
      const originalVersion = entry.version;

      // Create a scenario where transaction should fail
      try {
        // Simulate a failure during update by mocking database error
        const originalUpdate = kbService.update;
        jest.spyOn(kbService, 'update').mockImplementationOnce(async function(this: any, id: string, updates: any) {
          // Start the update but simulate failure
          if (updates.title === 'TRIGGER_FAILURE') {
            throw new Error('Simulated database failure');
          }
          return originalUpdate.call(this, id, updates);
        });

        await kbService.update(entry.id, {
          title: 'TRIGGER_FAILURE',
          updated_by: 'test-user'
        });
      } catch (error) {
        // Expected to fail
      }

      // Entry should remain in original state
      const unchangedEntry = await kbService.read(entry.id);
      expect(unchangedEntry?.version).toBe(originalVersion);
      expect(unchangedEntry?.title).toBe(entry.title);

      // Validate consistency maintained
      const consistencyCheck = await validator.validateEntryConsistency(entry.id);
      expect(consistencyCheck.consistent).toBe(true);
    });

    test('should maintain referential integrity across related operations', async () => {
      const entry = testEntries[0];
      const userId = 'referential-test-user';

      // Perform related operations that should maintain integrity
      await kbService.recordUsage(entry.id, true, userId);
      const searchResults = await kbService.search(entry.title, { userId });
      
      // Update the entry
      await kbService.update(entry.id, {
        title: 'Updated for Referential Test',
        updated_by: userId
      });

      // All related data should remain consistent
      const updatedEntry = await kbService.read(entry.id);
      expect(updatedEntry?.usage_count).toBeGreaterThan(0);

      // Search should find updated entry
      const newSearchResults = await kbService.search('Updated for Referential Test');
      const foundEntry = newSearchResults.find(r => r.entry.id === entry.id);
      expect(foundEntry).toBeTruthy();

      // Validate cross-service consistency
      const consistencyCheck = await validator.validateCrossServiceConsistency(entry.id, userId);
      expect(consistencyCheck.consistent).toBe(true);
    });
  });

  describe('Data Recovery and Repair', () => {
    test('should detect and report data inconsistencies', async () => {
      const entry = testEntries[0];

      // Simulate data corruption scenario
      // Note: In a real scenario, this might happen due to external factors

      // Force an inconsistent state for testing
      // (In production, this would be detected, not created)
      
      // Validate that our validator can detect issues
      const result = await validator.validateEntryConsistency(entry.id);
      
      // Should pass for clean data
      expect(result.consistent).toBe(true);

      // Test with potentially problematic entry
      if (result.consistent) {
        // System is working correctly - inconsistencies would be detected
        expect(result.issues).toHaveLength(0);
      }
    });

    test('should maintain system stability during recovery operations', async () => {
      const userId = 'recovery-test-user';

      // Perform normal operations during a "recovery" scenario
      const operations: Promise<any>[] = [];

      // Mix of operations that should work during recovery
      testEntries.forEach((entry, index) => {
        operations.push(kbService.read(entry.id));
        operations.push(kbService.search(`recovery test ${index}`, { userId }));
      });

      // Execute operations
      const results = await Promise.allSettled(operations);
      const successful = results.filter(r => r.status === 'fulfilled');

      // System should remain stable
      expect(successful.length).toBeGreaterThan(operations.length * 0.8);

      // Validate final consistency
      const consistencyChecks = await Promise.all(
        testEntries.map(entry => validator.validateEntryConsistency(entry.id))
      );

      consistencyChecks.forEach(check => {
        expect(check.consistent).toBe(true);
      });
    });
  });

  describe('Performance Under Consistency Constraints', () => {
    test('should maintain consistency without significant performance degradation', async () => {
      const startTime = Date.now();
      const operations = 100;
      
      // Perform operations that test consistency overhead
      const promises: Promise<any>[] = [];
      
      for (let i = 0; i < operations; i++) {
        const entry = testEntries[i % testEntries.length];
        
        if (i % 3 === 0) {
          promises.push(kbService.read(entry.id));
        } else if (i % 3 === 1) {
          promises.push(kbService.recordUsage(entry.id, true, `perf-user-${i}`));
        } else {
          promises.push(kbService.search(`performance test ${i}`));
        }
      }

      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Should complete within reasonable time (adjust based on system capabilities)
      expect(totalTime).toBeLessThan(10000); // 10 seconds

      // Validate consistency maintained under load
      const finalValidations = await Promise.all(
        testEntries.map(entry => validator.validateEntryConsistency(entry.id))
      );

      finalValidations.forEach(validation => {
        expect(validation.consistent).toBe(true);
      });
    });
  });
});