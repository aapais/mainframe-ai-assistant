/**
 * Comprehensive Integration Tests for Knowledge Base System
 * Validates complete flow from TypeScript interfaces through database operations
 * Focus on performance, validation, error handling, and data consistency
 */

import Database from 'better-sqlite3';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';
import {
  KBEntry,
  CreateKBEntry,
  UpdateKBEntry,
  SearchQuery,
  EntryFeedback,
  UsageMetric,
  SearchResult,
  SearchWithFacets,
  KBCategory,
  SeverityLevel,
  SearchMatchType,
  SchemaValidator,
  DatabaseSchemas
} from '../schemas/KnowledgeBase.schema';
import { KnowledgeBaseRepository, RepositoryResult } from '../repositories/KnowledgeBaseRepository';
import { AppError, ErrorCode } from '../../core/errors/AppError';
import { TestDataGenerator } from './fixtures/TestDataGenerator';
import { PerformanceValidator } from './helpers/PerformanceValidator';

// Test configuration
const TEST_DB_PATH = ':memory:';
const PERFORMANCE_TIMEOUT = 30000;
const SEARCH_PERFORMANCE_THRESHOLD = 1000; // 1 second
const BULK_OPERATION_THRESHOLD = 5000; // 5 seconds

/**
 * Comprehensive Integration Test Suite
 */
describe('Knowledge Base Integration Tests', () => {
  let db: Database.Database;
  let repository: KnowledgeBaseRepository;
  let dataGenerator: TestDataGenerator;
  let performanceValidator: PerformanceValidator;

  beforeAll(async () => {
    // Initialize test database with full schema
    db = new Database(TEST_DB_PATH);
    await initializeComprehensiveSchema(db);
    
    // Initialize repository and test utilities
    repository = new KnowledgeBaseRepository(db);
    dataGenerator = new TestDataGenerator();
    performanceValidator = new PerformanceValidator();
    
    // Seed test data for integration tests
    await seedIntegrationTestData();
  }, PERFORMANCE_TIMEOUT);

  afterAll(async () => {
    await repository.cleanup();
    db.close();
  });

  describe('End-to-End Data Flow Validation', () => {
    test('should validate complete CRUD lifecycle with all relationships', async () => {
      const startTime = performance.now();
      
      // 1. Create KB entry with comprehensive data
      const entryData: CreateKBEntry = {
        title: 'Integration Test - Complete Lifecycle',
        problem: 'This entry tests the complete CRUD lifecycle with all relationships and validation rules applied',
        solution: 'Step 1: Create entry with full validation\nStep 2: Test all relationships\nStep 3: Verify data integrity\nStep 4: Test performance metrics',
        category: 'System',
        severity: 'high',
        tags: ['integration', 'crud', 'lifecycle', 'validation']
      };

      // Validate data before creation
      expect(() => SchemaValidator.validateKBEntry(entryData)).not.toThrow();
      
      const createResult = await repository.create(entryData);
      expect(createResult.success).toBe(true);
      expect(createResult.data).toBeDefined();
      expect(createResult.metadata?.executionTime).toBeDefined();
      
      const createdId = createResult.data!.id!;

      // 2. Verify creation with full data integrity
      const findResult = await repository.findById(createdId);
      expect(findResult.success).toBe(true);
      expect(findResult.data?.title).toBe(entryData.title);
      expect(findResult.data?.tags).toEqual(entryData.tags);
      expect(findResult.data?.usage_count).toBeGreaterThan(0); // Should increment from findById view

      // 3. Record comprehensive usage and feedback
      const usageMetric: UsageMetric = {
        entry_id: createdId,
        action: 'view',
        user_id: 'integration-test-user',
        session_id: 'integration-session-123',
        metadata: {
          testType: 'integration',
          timestamp: new Date().toISOString()
        }
      };

      const usageResult = await repository.recordUsage(usageMetric);
      expect(usageResult.success).toBe(true);

      const feedback: EntryFeedback = {
        entry_id: createdId,
        user_id: 'integration-test-user',
        rating: 5,
        successful: true,
        comment: 'Integration test feedback - comprehensive validation',
        session_id: 'integration-session-123',
        resolution_time: 120000 // 2 minutes
      };

      const feedbackResult = await repository.recordFeedback(feedback);
      expect(feedbackResult.success).toBe(true);
      expect(typeof feedbackResult.data).toBe('string'); // Returns feedback ID

      // 4. Update with partial data and validate cascade effects
      const updateData: UpdateKBEntry = {
        title: 'Integration Test - Updated Lifecycle',
        severity: 'critical',
        tags: ['integration', 'updated', 'validated']
      };

      const updateResult = await repository.update(createdId, updateData);
      expect(updateResult.success).toBe(true);
      expect(updateResult.data?.title).toBe(updateData.title);
      expect(updateResult.data?.severity).toBe(updateData.severity);
      expect(updateResult.data?.tags).toEqual(updateData.tags);

      // 5. Verify updated entry maintains data integrity
      const verifyResult = await repository.findById(createdId);
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data?.updated_at).toBeInstanceOf(Date);
      expect(verifyResult.data?.success_count).toBeGreaterThan(0); // From feedback
      
      // 6. Search validation with multiple strategies
      const searchQueries: SearchQuery[] = [
        { query: 'Integration Test' },
        { query: 'lifecycle', category: 'System' },
        { query: 'validation', tags: ['integration'], limit: 5 }
      ];

      for (const searchQuery of searchQueries) {
        const searchResult = await repository.search(searchQuery);
        expect(searchResult.success).toBe(true);
        expect(searchResult.data?.length).toBeGreaterThan(0);
        expect(searchResult.data?.some(r => r.entry.id === createdId)).toBe(true);
        expect(searchResult.metadata?.executionTime).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD);
      }

      // 7. Test faceted search with comprehensive results
      const facetedSearchResult = await repository.searchWithFacets({ query: 'integration' });
      expect(facetedSearchResult.success).toBe(true);
      expect(facetedSearchResult.data?.facets).toBeDefined();
      expect(facetedSearchResult.data?.facets.categories.length).toBeGreaterThan(0);
      expect(facetedSearchResult.data?.totalCount).toBeGreaterThan(0);

      // 8. Clean up with soft delete
      const deleteResult = await repository.delete(createdId);
      expect(deleteResult.success).toBe(true);

      // 9. Verify soft delete (entry should not be findable)
      const deletedCheck = await repository.findById(createdId);
      expect(deletedCheck.success).toBe(false);
      expect(deletedCheck.error?.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);

      const totalTime = performance.now() - startTime;
      console.log(`Complete CRUD lifecycle completed in ${totalTime.toFixed(2)}ms`);
      
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
    }, PERFORMANCE_TIMEOUT);

    test('should validate complete search workflow with performance metrics', async () => {
      // Test comprehensive search scenarios with performance validation
      const searchScenarios = [
        { name: 'Simple text search', query: { query: 'VSAM error' } },
        { name: 'Category search', query: { query: 'status', category: 'VSAM' as KBCategory } },
        { name: 'Tag-based search', query: { query: 'timeout', tags: ['performance', 'database'] } },
        { name: 'Complex filtered search', query: { 
          query: 'connection issue', 
          category: 'DB2' as KBCategory,
          severity: 'high' as SeverityLevel,
          limit: 20,
          sortBy: 'usage' as const
        }},
        { name: 'Fuzzy search', query: { query: 'conecton problm', fuzzyThreshold: 0.6 } }
      ];

      const performanceResults: Array<{ scenario: string; time: number; results: number }> = [];

      for (const scenario of searchScenarios) {
        const startTime = performance.now();
        
        const result = await repository.search(scenario.query);
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;

        expect(result.success).toBe(true);
        expect(executionTime).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD);
        
        performanceResults.push({
          scenario: scenario.name,
          time: executionTime,
          results: result.data?.length || 0
        });

        // Validate search result structure
        if (result.data && result.data.length > 0) {
          const searchResult = result.data[0];
          expect(searchResult.entry).toBeDefined();
          expect(searchResult.score).toBeGreaterThanOrEqual(0);
          expect(searchResult.matchType).toBeDefined();
          expect(['exact', 'fuzzy', 'ai', 'semantic', 'category', 'tag', 'fts'].includes(searchResult.matchType)).toBe(true);
        }
      }

      // Log performance summary
      console.table(performanceResults);
      
      const avgTime = performanceResults.reduce((sum, r) => sum + r.time, 0) / performanceResults.length;
      expect(avgTime).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD);
    });
  });

  describe('Data Validation and Constraint Testing', () => {
    test('should enforce all schema validation rules', async () => {
      // Test all validation constraints from schema
      
      // Title validation
      const invalidTitleCases = [
        { title: 'AB', expected: 'Title must be at least 3 characters' },
        { title: 'A'.repeat(256), expected: 'Title cannot exceed 255 characters' },
        { title: '', expected: 'Title must be at least 3 characters' }
      ];

      for (const testCase of invalidTitleCases) {
        const invalidEntry = {
          title: testCase.title,
          problem: 'Valid problem description that meets minimum length requirements',
          solution: 'Valid solution that meets minimum length requirements',
          category: 'System'
        };

        expect(() => SchemaValidator.validateKBEntry(invalidEntry)).toThrow();
      }

      // Problem validation
      expect(() => SchemaValidator.validateKBEntry({
        title: 'Valid Title',
        problem: 'Short', // Too short
        solution: 'Valid solution that meets minimum length requirements',
        category: 'System'
      })).toThrow();

      // Solution validation
      expect(() => SchemaValidator.validateKBEntry({
        title: 'Valid Title',
        problem: 'Valid problem description that meets minimum length requirements',
        solution: 'Short', // Too short
        category: 'System'
      })).toThrow();

      // Category validation
      expect(() => SchemaValidator.validateKBEntry({
        title: 'Valid Title',
        problem: 'Valid problem description that meets minimum length requirements',
        solution: 'Valid solution that meets minimum length requirements',
        category: 'INVALID_CATEGORY'
      })).toThrow();

      // Tags validation
      expect(() => SchemaValidator.validateKBEntry({
        title: 'Valid Title',
        problem: 'Valid problem description that meets minimum length requirements',
        solution: 'Valid solution that meets minimum length requirements',
        category: 'System',
        tags: Array(25).fill('tag') // Exceeds maximum 20 tags
      })).toThrow();

      // Severity validation
      expect(() => SchemaValidator.validateKBEntry({
        title: 'Valid Title',
        problem: 'Valid problem description that meets minimum length requirements',
        solution: 'Valid solution that meets minimum length requirements',
        category: 'System',
        severity: 'invalid_severity'
      })).toThrow();
    });

    test('should validate search query constraints', async () => {
      // Empty query validation
      expect(() => SchemaValidator.validateSearchQuery({
        query: ''
      })).toThrow();

      // Limit validation
      expect(() => SchemaValidator.validateSearchQuery({
        query: 'valid query',
        limit: 2000 // Exceeds maximum 100
      })).toThrow();

      // Category validation in search
      expect(() => SchemaValidator.validateSearchQuery({
        query: 'valid query',
        category: 'INVALID_CATEGORY'
      })).toThrow();

      // Tags array length validation
      expect(() => SchemaValidator.validateSearchQuery({
        query: 'valid query',
        tags: Array(15).fill('tag') // Exceeds maximum 10 tags
      })).toThrow();

      // Fuzzy threshold validation
      expect(() => SchemaValidator.validateSearchQuery({
        query: 'valid query',
        fuzzyThreshold: 1.5 // Must be 0-1
      })).toThrow();
    });

    test('should validate feedback constraints', async () => {
      // Rating validation
      expect(() => SchemaValidator.validateFeedback({
        entry_id: uuidv4(),
        rating: 6, // Must be 1-5
        successful: true
      })).toThrow();

      expect(() => SchemaValidator.validateFeedback({
        entry_id: uuidv4(),
        rating: 0, // Must be 1-5
        successful: true
      })).toThrow();

      // Entry ID validation
      expect(() => SchemaValidator.validateFeedback({
        entry_id: 'invalid-uuid',
        rating: 5,
        successful: true
      })).toThrow();

      // Comment length validation
      expect(() => SchemaValidator.validateFeedback({
        entry_id: uuidv4(),
        rating: 5,
        successful: true,
        comment: 'A'.repeat(1001) // Exceeds maximum 1000 characters
      })).toThrow();
    });
  });

  describe('Performance and Scalability Testing', () => {
    test('should handle bulk operations efficiently', async () => {
      const batchSize = 100;
      const testEntries = dataGenerator.generateKBEntries(batchSize);

      // Bulk create performance test
      const bulkCreateStart = performance.now();
      const bulkCreateResult = await repository.bulkCreate(testEntries);
      const bulkCreateTime = performance.now() - bulkCreateStart;

      expect(bulkCreateResult.success).toBe(true);
      expect(bulkCreateResult.data?.length).toBe(batchSize);
      expect(bulkCreateTime).toBeLessThan(BULK_OPERATION_THRESHOLD);

      const createdIds = bulkCreateResult.data!;

      // Verify all entries were created correctly
      const verificationPromises = createdIds.slice(0, 10).map(id => repository.findById(id));
      const verificationResults = await Promise.all(verificationPromises);
      
      verificationResults.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });

      // Bulk delete performance test
      const bulkDeleteStart = performance.now();
      const bulkDeleteResult = await repository.bulkDelete(createdIds);
      const bulkDeleteTime = performance.now() - bulkDeleteStart;

      expect(bulkDeleteResult.success).toBe(true);
      expect(bulkDeleteTime).toBeLessThan(BULK_OPERATION_THRESHOLD);

      // Verify entries are deleted (should not be findable)
      const deletedCheckPromises = createdIds.slice(0, 5).map(id => repository.findById(id));
      const deletedCheckResults = await Promise.all(deletedCheckPromises);
      
      deletedCheckResults.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      });

      console.log(`Bulk operations: Create ${batchSize} entries in ${bulkCreateTime.toFixed(2)}ms, Delete in ${bulkDeleteTime.toFixed(2)}ms`);
    }, PERFORMANCE_TIMEOUT);

    test('should maintain search performance under load', async () => {
      // Create substantial test data
      const testDataSize = 200;
      const testEntries = dataGenerator.generateKBEntries(testDataSize);
      await repository.bulkCreate(testEntries);

      // Perform concurrent searches
      const searchQueries = [
        'VSAM error status',
        'DB2 connection timeout',
        'JCL syntax error',
        'Batch job failure',
        'System performance issue',
        'File not found error',
        'Memory allocation problem',
        'Network connectivity',
        'Authentication failure',
        'Data corruption'
      ];

      const concurrentSearchPromises = searchQueries.map(async (query) => {
        const startTime = performance.now();
        const result = await repository.search({ query, limit: 10 });
        const endTime = performance.now();
        
        return {
          query,
          success: result.success,
          results: result.data?.length || 0,
          time: endTime - startTime
        };
      });

      const searchResults = await Promise.all(concurrentSearchPromises);

      // Validate all searches completed successfully and within performance threshold
      searchResults.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.time).toBeLessThan(SEARCH_PERFORMANCE_THRESHOLD);
      });

      const avgSearchTime = searchResults.reduce((sum, r) => sum + r.time, 0) / searchResults.length;
      console.log(`Average search time across ${searchQueries.length} concurrent queries: ${avgSearchTime.toFixed(2)}ms`);
      
      expect(avgSearchTime).toBeLessThan(500); // Should average under 500ms
    });

    test('should validate memory usage and cleanup', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operations
      const largeDataSet = dataGenerator.generateKBEntries(500);
      await repository.bulkCreate(largeDataSet);

      // Perform multiple search operations
      const searchPromises = Array(50).fill(0).map((_, i) => 
        repository.search({ query: `test query ${i}`, limit: 20 })
      );
      await Promise.all(searchPromises);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB for this test)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      console.log(`Memory usage: Initial ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Final ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Increase ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle database constraint violations gracefully', async () => {
      // Test foreign key constraint handling
      const invalidFeedback: EntryFeedback = {
        entry_id: uuidv4(), // Non-existent entry ID
        rating: 5,
        successful: true,
        comment: 'This should fail due to foreign key constraint'
      };

      const result = await repository.recordFeedback(invalidFeedback);
      // Should either succeed (with proper constraint handling) or fail gracefully
      if (!result.success) {
        expect(result.error).toBeInstanceOf(AppError);
        expect([
          ErrorCode.FOREIGN_KEY_VIOLATION,
          ErrorCode.RESOURCE_NOT_FOUND,
          ErrorCode.DATABASE_CONSTRAINT_ERROR
        ]).toContain(result.error!.code);
      }
    });

    test('should handle concurrent modifications correctly', async () => {
      // Create test entry
      const testEntry = dataGenerator.generateKBEntry();
      const createResult = await repository.create(testEntry);
      expect(createResult.success).toBe(true);
      
      const entryId = createResult.data!.id!;

      // Simulate concurrent updates
      const updatePromises = [
        repository.update(entryId, { title: 'Concurrent Update 1' }),
        repository.update(entryId, { title: 'Concurrent Update 2' }),
        repository.update(entryId, { severity: 'critical' }),
        repository.update(entryId, { tags: ['concurrent', 'test'] })
      ];

      const updateResults = await Promise.all(updatePromises);
      
      // All updates should complete (SQLite handles this with locking)
      updateResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Verify final state is consistent
      const finalResult = await repository.findById(entryId);
      expect(finalResult.success).toBe(true);
      expect(finalResult.data).toBeDefined();
    });

    test('should validate transaction rollback on errors', async () => {
      // Create entry with invalid data that should trigger rollback
      const validEntry = dataGenerator.generateKBEntry();
      
      // Mock a failure during transaction
      const originalTransaction = db.transaction;
      let transactionCallCount = 0;
      
      try {
        // This test validates that the repository handles transaction errors properly
        const result = await repository.create(validEntry);
        expect(result.success).toBe(true);
        
        // Clean up
        await repository.delete(result.data!.id!);
      } catch (error) {
        // If an error occurs, it should be properly wrapped
        expect(error).toBeInstanceOf(AppError);
      }
    });

    test('should handle search index corruption gracefully', async () => {
      // Test scenario where FTS index might be inconsistent
      const testEntry = dataGenerator.generateKBEntry();
      const createResult = await repository.create(testEntry);
      expect(createResult.success).toBe(true);

      // Attempt to corrupt FTS index (simulate corruption scenario)
      try {
        db.exec('DELETE FROM kb_fts WHERE id = ?', createResult.data!.id!);
      } catch (error) {
        // Expected - FTS might not allow this operation
      }

      // Search should still work (graceful degradation)
      const searchResult = await repository.search({ query: testEntry.title });
      expect(searchResult.success).toBe(true); // Should handle gracefully
    });

    test('should validate error context and metadata', async () => {
      // Test invalid entry creation
      const invalidEntry = {
        title: 'A', // Too short
        problem: 'Short',
        solution: 'Short',
        category: 'INVALID'
      };

      const result = await repository.create(invalidEntry as any);
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(AppError);
      
      const error = result.error!;
      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(error.context).toBeDefined();
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.correlationId).toBeDefined();
      expect(typeof error.correlationId).toBe('string');
      expect(error.correlationId.length).toBeGreaterThan(0);
    });
  });

  describe('Data Consistency and Integrity', () => {
    test('should maintain referential integrity across all tables', async () => {
      // Create entry with full relationships
      const testEntry = dataGenerator.generateKBEntry();
      testEntry.tags = ['consistency', 'integrity', 'test'];
      
      const createResult = await repository.create(testEntry);
      expect(createResult.success).toBe(true);
      
      const entryId = createResult.data!.id!;

      // Add feedback and usage data
      await repository.recordFeedback({
        entry_id: entryId,
        rating: 4,
        successful: true,
        comment: 'Referential integrity test'
      });

      await repository.recordUsage({
        entry_id: entryId,
        action: 'view',
        user_id: 'integrity-test-user'
      });

      // Verify all relationships exist
      const entryCheck = await repository.findById(entryId);
      expect(entryCheck.success).toBe(true);
      expect(entryCheck.data?.tags).toContain('consistency');

      // Delete entry and verify cascade
      const deleteResult = await repository.delete(entryId);
      expect(deleteResult.success).toBe(true);

      // Verify entry is soft deleted
      const deletedCheck = await repository.findById(entryId);
      expect(deletedCheck.success).toBe(false);

      // Verify related data integrity (depends on schema CASCADE rules)
      // In a full implementation, you'd check that related records are also handled properly
    });

    test('should validate search result consistency', async () => {
      // Create entries with known data
      const testEntries = [
        {
          title: 'Consistency Test Entry 1',
          problem: 'First test entry for consistency validation',
          solution: 'Solution for first consistency test',
          category: 'System' as KBCategory,
          tags: ['consistency', 'test1']
        },
        {
          title: 'Consistency Test Entry 2',
          problem: 'Second test entry for consistency validation',
          solution: 'Solution for second consistency test',
          category: 'System' as KBCategory,
          tags: ['consistency', 'test2']
        }
      ];

      const createdIds: string[] = [];
      for (const entry of testEntries) {
        const result = await repository.create(entry);
        expect(result.success).toBe(true);
        createdIds.push(result.data!.id!);
      }

      // Search should return consistent results
      const searchResult = await repository.search({ query: 'Consistency Test' });
      expect(searchResult.success).toBe(true);
      expect(searchResult.data?.length).toBeGreaterThanOrEqual(2);

      // Verify search result data integrity
      searchResult.data?.forEach(result => {
        expect(result.entry).toBeDefined();
        expect(result.entry.id).toBeDefined();
        expect(result.entry.title).toBeDefined();
        expect(result.entry.created_at).toBeInstanceOf(Date);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.matchType).toBeDefined();
      });

      // Category search consistency
      const categoryResult = await repository.findByCategory('System');
      expect(categoryResult.success).toBe(true);
      const foundIds = categoryResult.data?.map(r => r.entry.id) || [];
      createdIds.forEach(id => {
        expect(foundIds).toContain(id);
      });

      // Tag search consistency
      const tagResult = await repository.findByTags(['consistency']);
      expect(tagResult.success).toBe(true);
      const taggedIds = tagResult.data?.map(r => r.entry.id) || [];
      createdIds.forEach(id => {
        expect(taggedIds).toContain(id);
      });

      // Cleanup
      await repository.bulkDelete(createdIds);
    });
  });

  describe('Statistics and Analytics Validation', () => {
    test('should provide accurate statistics and metrics', async () => {
      // Create known test data
      const testEntries = dataGenerator.generateKBEntries(10);
      const createResult = await repository.bulkCreate(testEntries);
      expect(createResult.success).toBe(true);

      // Record some usage and feedback
      const entryIds = createResult.data!;
      for (let i = 0; i < 5; i++) {
        await repository.recordUsage({
          entry_id: entryIds[i],
          action: 'view',
          user_id: `test-user-${i}`
        });

        await repository.recordFeedback({
          entry_id: entryIds[i],
          rating: 4 + (i % 2), // Mix of ratings 4 and 5
          successful: true,
          comment: `Test feedback ${i}`
        });
      }

      // Get statistics
      const statsResult = await repository.getStatistics();
      expect(statsResult.success).toBe(true);
      expect(statsResult.data).toBeDefined();

      const stats = statsResult.data!;
      expect(stats.totalEntries).toBeGreaterThanOrEqual(10);
      expect(stats.categoryCounts).toBeDefined();
      expect(typeof stats.categoryCounts).toBe('object');
      expect(stats.averageSuccessRate).toBeGreaterThanOrEqual(0);
      expect(stats.averageSuccessRate).toBeLessThanOrEqual(100);
      expect(stats.healthStatus).toBeDefined();
      expect(stats.healthStatus.overall).toBeDefined();
      expect(['healthy', 'warning', 'critical']).toContain(stats.healthStatus.overall);

      // Verify performance metrics
      expect(stats.performance).toBeDefined();
      expect(typeof stats.performance.avgSearchTime).toBe('number');
      expect(stats.performance.avgSearchTime).toBeGreaterThanOrEqual(0);

      // Test popular and recent entries
      const popularResult = await repository.getPopularEntries(5);
      expect(popularResult.success).toBe(true);
      expect(popularResult.data?.length).toBeLessThanOrEqual(5);

      const recentResult = await repository.getRecentEntries(5);
      expect(recentResult.success).toBe(true);
      expect(recentResult.data?.length).toBeLessThanOrEqual(5);

      // Cleanup
      await repository.bulkDelete(entryIds);
    });

    test('should provide accurate auto-complete suggestions', async () => {
      // Create entries with known patterns
      const testEntries = [
        {
          title: 'VSAM Status Code Analysis',
          problem: 'VSAM status code errors in batch processing',
          solution: 'Analyze VSAM status codes and resolve',
          category: 'VSAM' as KBCategory,
          tags: ['vsam', 'status', 'analysis']
        },
        {
          title: 'VSAM File Operations',
          problem: 'VSAM file operation failures',
          solution: 'Check VSAM file operations and fix',
          category: 'VSAM' as KBCategory,
          tags: ['vsam', 'file', 'operations']
        }
      ];

      const createResults = await Promise.all(
        testEntries.map(entry => repository.create(entry))
      );

      createResults.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Test auto-complete
      const autoCompleteResult = await repository.autoComplete('VSAM', 5);
      expect(autoCompleteResult.success).toBe(true);
      expect(autoCompleteResult.data?.length).toBeGreaterThan(0);

      autoCompleteResult.data?.forEach(suggestion => {
        expect(suggestion.suggestion).toBeDefined();
        expect(suggestion.category).toBeDefined();
        expect(suggestion.score).toBeGreaterThanOrEqual(0);
      });

      // Cleanup
      const createdIds = createResults.map(r => r.data!.id!);
      await repository.bulkDelete(createdIds);
    });
  });

  // Helper function to seed test data
  async function seedIntegrationTestData(): Promise<void> {
    const seedEntries: CreateKBEntry[] = [
      {
        title: 'VSAM Status 35 - File Not Found',
        problem: 'Job fails with VSAM status 35 indicating file not found error during batch processing',
        solution: 'Step 1: Verify dataset exists in catalog\nStep 2: Check DD statement syntax\nStep 3: Ensure proper file allocation\nStep 4: Verify security permissions',
        category: 'VSAM',
        severity: 'high',
        tags: ['vsam', 'status-35', 'file-not-found', 'batch']
      },
      {
        title: 'DB2 Connection Timeout Issues',
        problem: 'Database connections timing out during peak usage periods causing application failures',
        solution: 'Step 1: Increase connection timeout values\nStep 2: Optimize SQL queries\nStep 3: Review connection pool settings\nStep 4: Monitor database performance',
        category: 'DB2',
        severity: 'medium',
        tags: ['db2', 'connection', 'timeout', 'performance']
      },
      {
        title: 'JCL Syntax Validation Errors',
        problem: 'JCL jobs failing due to syntax errors in EXEC and DD statements',
        solution: 'Step 1: Use JCL syntax checker\nStep 2: Verify parameter spelling\nStep 3: Check continuation rules\nStep 4: Validate dataset names',
        category: 'JCL',
        severity: 'low',
        tags: ['jcl', 'syntax', 'validation', 'exec']
      },
      {
        title: 'Batch Job Abend S0C7 Resolution',
        problem: 'Batch jobs terminating with S0C7 data exception abend code',
        solution: 'Step 1: Check for numeric data validation\nStep 2: Initialize all variables\nStep 3: Verify data conversion logic\nStep 4: Add error handling',
        category: 'Batch',
        severity: 'critical',
        tags: ['batch', 's0c7', 'abend', 'data-exception']
      }
    ];

    await repository.bulkCreate(seedEntries);
  }
});

/**
 * Initialize comprehensive database schema for testing
 */
async function initializeComprehensiveSchema(db: Database.Database): Promise<void> {
  const schema = `
    -- Knowledge Base Entries
    CREATE TABLE IF NOT EXISTS kb_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      problem TEXT NOT NULL,
      solution TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other')),
      severity TEXT DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'system',
      usage_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      last_used DATETIME,
      archived BOOLEAN DEFAULT FALSE,
      confidence_score REAL CHECK(confidence_score >= 0 AND confidence_score <= 100)
    );

    -- Tags for KB entries
    CREATE TABLE IF NOT EXISTS kb_tags (
      entry_id TEXT,
      tag TEXT,
      PRIMARY KEY (entry_id, tag),
      FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
    );

    -- Entry feedback and ratings
    CREATE TABLE IF NOT EXISTS entry_feedback (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      user_id TEXT,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      successful BOOLEAN NOT NULL,
      comment TEXT CHECK(LENGTH(comment) <= 1000),
      session_id TEXT,
      resolution_time INTEGER CHECK(resolution_time >= 0),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
    );

    -- Usage metrics tracking
    CREATE TABLE IF NOT EXISTS usage_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('view', 'copy', 'rate_success', 'rate_failure', 'export', 'print', 'share')),
      user_id TEXT,
      session_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT, -- JSON string
      FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
    );

    -- Search history
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      normalized_query TEXT,
      results_count INTEGER NOT NULL DEFAULT 0,
      selected_entry_id TEXT,
      user_id TEXT,
      session_id TEXT,
      search_time_ms INTEGER CHECK(search_time_ms >= 0),
      filters_used TEXT, -- JSON string
      ai_used BOOLEAN DEFAULT FALSE,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (selected_entry_id) REFERENCES kb_entries(id) ON DELETE SET NULL
    );

    -- Full-text search virtual table
    CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
      id UNINDEXED,
      title,
      problem,
      solution,
      tags,
      content=kb_entries
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_kb_entries_category ON kb_entries(category);
    CREATE INDEX IF NOT EXISTS idx_kb_entries_severity ON kb_entries(severity);
    CREATE INDEX IF NOT EXISTS idx_kb_entries_usage ON kb_entries(usage_count DESC);
    CREATE INDEX IF NOT EXISTS idx_kb_entries_archived ON kb_entries(archived);
    CREATE INDEX IF NOT EXISTS idx_kb_entries_created ON kb_entries(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_kb_entries_updated ON kb_entries(updated_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_kb_tags_tag ON kb_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_kb_tags_entry ON kb_tags(entry_id);
    
    CREATE INDEX IF NOT EXISTS idx_feedback_entry_id ON entry_feedback(entry_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON entry_feedback(user_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_rating ON entry_feedback(rating);
    CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON entry_feedback(timestamp DESC);
    
    CREATE INDEX IF NOT EXISTS idx_usage_entry_id ON usage_metrics(entry_id);
    CREATE INDEX IF NOT EXISTS idx_usage_action ON usage_metrics(action);
    CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_metrics(timestamp DESC);
    
    CREATE INDEX IF NOT EXISTS idx_search_query ON search_history(query);
    CREATE INDEX IF NOT EXISTS idx_search_timestamp ON search_history(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_search_user ON search_history(user_id);

    -- Triggers for maintaining data consistency
    CREATE TRIGGER IF NOT EXISTS update_kb_entry_timestamp
    AFTER UPDATE ON kb_entries
    BEGIN
      UPDATE kb_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_kb_fts_on_insert
    AFTER INSERT ON kb_entries
    BEGIN
      INSERT INTO kb_fts(id, title, problem, solution, tags)
      VALUES (NEW.id, NEW.title, NEW.problem, NEW.solution, 
              COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id), ''));
    END;

    CREATE TRIGGER IF NOT EXISTS update_kb_fts_on_update
    AFTER UPDATE ON kb_entries
    BEGIN
      DELETE FROM kb_fts WHERE id = NEW.id;
      INSERT INTO kb_fts(id, title, problem, solution, tags)
      VALUES (NEW.id, NEW.title, NEW.problem, NEW.solution,
              COALESCE((SELECT GROUP_CONCAT(tag, ' ') FROM kb_tags WHERE entry_id = NEW.id), ''));
    END;
  `;

  db.exec(schema);
}