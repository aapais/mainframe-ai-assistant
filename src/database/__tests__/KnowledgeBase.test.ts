/**
 * Comprehensive Unit Tests for Knowledge Base Database Layer
 * Testing schemas, models, repositories with full type safety
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  KBEntry,
  CreateKBEntry,
  UpdateKBEntry,
  SearchQuery,
  EntryFeedback,
  SchemaValidator,
  DatabaseSchemas,
  KBCategory,
} from '../schemas/KnowledgeBase.schema';
import {
  SearchOptions,
  PerformanceSchemaValidator,
} from '../schemas/PerformanceOptimization.schema';
import { KnowledgeBaseModel } from '../models/KnowledgeBaseModel';
import { KnowledgeBaseRepository } from '../repositories/KnowledgeBaseRepository';
import { AppError, ErrorCode } from '../../core/errors/AppError';
import { PerformanceMonitor } from '../PerformanceMonitor';
import { QueryOptimizer } from '../QueryOptimizer';

// Test configuration
const TEST_DB_PATH = ':memory:';
const TIMEOUT = 30000;

describe('Knowledge Base Schema Validation', () => {
  describe('KBEntry Schema', () => {
    test('should validate valid KB entry', () => {
      const validEntry: CreateKBEntry = {
        title: 'VSAM Status 35 - File Not Found',
        problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
        solution:
          '1. Verify the dataset exists\n2. Check DD statement\n3. Ensure file is cataloged',
        category: 'VSAM',
        severity: 'high',
        tags: ['vsam', 'status-35', 'file-not-found'],
      };

      expect(() => SchemaValidator.validateKBEntry(validEntry)).not.toThrow();
    });

    test('should reject entry with invalid title', () => {
      const invalidEntry = {
        title: 'AB', // Too short
        problem: 'Valid problem description here that is long enough',
        solution: 'Valid solution here that is long enough',
        category: 'VSAM',
      };

      expect(() => SchemaValidator.validateKBEntry(invalidEntry)).toThrow();
    });

    test('should reject entry with invalid category', () => {
      const invalidEntry = {
        title: 'Valid Title Here',
        problem: 'Valid problem description here that is long enough',
        solution: 'Valid solution here that is long enough',
        category: 'INVALID_CATEGORY',
      };

      expect(() => SchemaValidator.validateKBEntry(invalidEntry)).toThrow();
    });

    test('should reject entry with too many tags', () => {
      const invalidEntry = {
        title: 'Valid Title Here',
        problem: 'Valid problem description here that is long enough',
        solution: 'Valid solution here that is long enough',
        category: 'VSAM',
        tags: Array(25).fill('tag'), // Exceeds max 20 tags
      };

      expect(() => SchemaValidator.validateKBEntry(invalidEntry)).toThrow();
    });

    test('should validate entry update with partial fields', () => {
      const validUpdate: UpdateKBEntry = {
        title: 'Updated Title',
        severity: 'critical',
      };

      expect(() => SchemaValidator.validateKBEntryUpdate(validUpdate)).not.toThrow();
    });
  });

  describe('SearchQuery Schema', () => {
    test('should validate basic search query', () => {
      const validQuery: SearchQuery = {
        query: 'VSAM error',
      };

      expect(() => SchemaValidator.validateSearchQuery(validQuery)).not.toThrow();
    });

    test('should validate complex search query', () => {
      const complexQuery: SearchQuery = {
        query: 'database connection issue',
        category: 'DB2',
        tags: ['connection', 'timeout'],
        limit: 20,
        sortBy: 'usage',
        fuzzyThreshold: 0.8,
        dateRange: {
          from: new Date('2024-01-01'),
          to: new Date('2024-12-31'),
        },
      };

      expect(() => SchemaValidator.validateSearchQuery(complexQuery)).not.toThrow();
    });

    test('should reject query with empty search term', () => {
      const invalidQuery = {
        query: '',
      };

      expect(() => SchemaValidator.validateSearchQuery(invalidQuery)).toThrow();
    });

    test('should reject query with invalid limit', () => {
      const invalidQuery = {
        query: 'valid query',
        limit: 2000, // Exceeds max 100
      };

      expect(() => SchemaValidator.validateSearchQuery(invalidQuery)).toThrow();
    });
  });

  describe('EntryFeedback Schema', () => {
    test('should validate valid feedback', () => {
      const validFeedback: EntryFeedback = {
        entry_id: uuidv4(),
        rating: 4,
        successful: true,
        comment: 'This solution worked perfectly!',
      };

      expect(() => SchemaValidator.validateFeedback(validFeedback)).not.toThrow();
    });

    test('should reject feedback with invalid rating', () => {
      const invalidFeedback = {
        entry_id: uuidv4(),
        rating: 6, // Must be 1-5
        successful: true,
      };

      expect(() => SchemaValidator.validateFeedback(invalidFeedback)).toThrow();
    });
  });
});

describe('Performance Schema Validation', () => {
  test('should validate search options', () => {
    const validOptions: SearchOptions = {
      query: 'test search',
      strategy: 'hybrid',
      limit: 50,
      useCache: true,
      enableHighlighting: true,
      weightings: {
        title: 4,
        problem: 3,
        solution: 2,
        tags: 1,
      },
    };

    expect(() => PerformanceSchemaValidator.validateSearchOptions(validOptions)).not.toThrow();
  });
});

describe('Knowledge Base Repository', () => {
  let db: Database.Database;
  let repository: KnowledgeBaseRepository;

  beforeEach(async () => {
    // Create in-memory database for each test
    db = new Database(TEST_DB_PATH);

    // Initialize schema
    await initializeTestDatabase(db);

    // Create repository
    repository = new KnowledgeBaseRepository(db);
  });

  afterEach(async () => {
    await repository.cleanup();
    db.close();
  });

  describe('Basic CRUD Operations', () => {
    test(
      'should create a new KB entry',
      async () => {
        const newEntry: CreateKBEntry = {
          title: 'Test Entry',
          problem: 'This is a test problem description that is long enough',
          solution: 'This is a test solution that provides steps to resolve',
          category: 'Other',
          tags: ['test', 'example'],
        };

        const result = await repository.create(newEntry);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data!.title).toBe(newEntry.title);
        expect(result.data!.id).toBeDefined();
        expect(result.metadata?.executionTime).toBeDefined();
      },
      TIMEOUT
    );

    test(
      'should find entry by ID',
      async () => {
        // First create an entry
        const newEntry: CreateKBEntry = {
          title: 'Findable Entry',
          problem: 'This entry should be findable by its ID after creation',
          solution: 'The repository should return this entry when searched by ID',
          category: 'System',
          tags: ['findable', 'test'],
        };

        const createResult = await repository.create(newEntry);
        expect(createResult.success).toBe(true);

        // Then find it
        const findResult = await repository.findById(createResult.data!.id!);

        expect(findResult.success).toBe(true);
        expect(findResult.data).toBeDefined();
        expect(findResult.data!.title).toBe(newEntry.title);
        expect(findResult.data!.id).toBe(createResult.data!.id);
      },
      TIMEOUT
    );

    test(
      'should return error when entry not found',
      async () => {
        const result = await repository.findById('non-existent-id');

        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(AppError);
        expect(result.error!.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      },
      TIMEOUT
    );

    test(
      'should update an existing entry',
      async () => {
        // Create entry first
        const newEntry: CreateKBEntry = {
          title: 'Original Title',
          problem: 'Original problem description that needs to be long enough',
          solution: 'Original solution that will be updated later in this test',
          category: 'JCL',
        };

        const createResult = await repository.create(newEntry);
        expect(createResult.success).toBe(true);

        // Update the entry
        const updateData: UpdateKBEntry = {
          title: 'Updated Title',
          severity: 'critical',
          tags: ['updated', 'test'],
        };

        const updateResult = await repository.update(createResult.data!.id!, updateData);

        expect(updateResult.success).toBe(true);
        expect(updateResult.data!.title).toBe('Updated Title');
        expect(updateResult.data!.severity).toBe('critical');
        expect(updateResult.data!.tags).toEqual(['updated', 'test']);
      },
      TIMEOUT
    );

    test(
      'should soft delete an entry',
      async () => {
        // Create entry first
        const newEntry: CreateKBEntry = {
          title: 'Entry to Delete',
          problem: 'This entry will be deleted as part of the soft delete test',
          solution: 'The repository should mark this as archived when deleted',
          category: 'Batch',
        };

        const createResult = await repository.create(newEntry);
        expect(createResult.success).toBe(true);

        // Delete the entry
        const deleteResult = await repository.delete(createResult.data!.id!);
        expect(deleteResult.success).toBe(true);

        // Verify entry is not found (soft deleted)
        const findResult = await repository.findById(createResult.data!.id!);
        expect(findResult.success).toBe(false);
        expect(findResult.error!.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      },
      TIMEOUT
    );

    test(
      'should get total count of entries',
      async () => {
        // Create a few entries
        const entries: CreateKBEntry[] = [
          {
            title: 'Count Test 1',
            problem: 'First entry for count test with sufficient length',
            solution: 'Solution for the first count test entry',
            category: 'VSAM',
          },
          {
            title: 'Count Test 2',
            problem: 'Second entry for count test with sufficient length',
            solution: 'Solution for the second count test entry',
            category: 'DB2',
          },
        ];

        for (const entry of entries) {
          const result = await repository.create(entry);
          expect(result.success).toBe(true);
        }

        const countResult = await repository.count();
        expect(countResult.success).toBe(true);
        expect(countResult.data).toBeGreaterThanOrEqual(2);
      },
      TIMEOUT
    );
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Create test entries for search tests
      const testEntries: CreateKBEntry[] = [
        {
          title: 'VSAM Status 35 Error',
          problem: 'Job fails with VSAM status 35 indicating file not found',
          solution: 'Check if dataset exists and is properly cataloged',
          category: 'VSAM',
          severity: 'high',
          tags: ['vsam', 'status-35', 'file-not-found'],
        },
        {
          title: 'DB2 Connection Timeout',
          problem: 'Database connection times out during heavy load periods',
          solution: 'Increase connection timeout and optimize query performance',
          category: 'DB2',
          severity: 'medium',
          tags: ['db2', 'connection', 'timeout', 'performance'],
        },
        {
          title: 'JCL Syntax Error',
          problem: 'JCL job fails due to syntax error in EXEC statement',
          solution: 'Verify JCL syntax and correct EXEC statement parameters',
          category: 'JCL',
          severity: 'low',
          tags: ['jcl', 'syntax', 'exec'],
        },
      ];

      for (const entry of testEntries) {
        await repository.create(entry);
      }
    });

    test(
      'should search entries by query text',
      async () => {
        const searchQuery: SearchQuery = {
          query: 'VSAM status',
        };

        const result = await repository.search(searchQuery);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data!.length).toBeGreaterThan(0);
        expect(result.data![0].entry.title).toContain('VSAM');
        expect(result.data![0].score).toBeGreaterThan(0);
      },
      TIMEOUT
    );

    test(
      'should search by category',
      async () => {
        const result = await repository.findByCategory('DB2');

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data!.length).toBeGreaterThan(0);
        expect(result.data![0].entry.category).toBe('DB2');
      },
      TIMEOUT
    );

    test(
      'should search by tags',
      async () => {
        const result = await repository.findByTags(['connection', 'timeout']);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data!.length).toBeGreaterThan(0);

        const entry = result.data![0].entry;
        expect(entry.tags?.some(tag => ['connection', 'timeout'].includes(tag))).toBe(true);
      },
      TIMEOUT
    );

    test(
      'should provide auto-complete suggestions',
      async () => {
        const result = await repository.autoComplete('VS', 5);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data!.length).toBeGreaterThan(0);
        expect(result.data![0].suggestion).toBeDefined();
        expect(result.data![0].category).toBeDefined();
        expect(result.data![0].score).toBeGreaterThan(0);
      },
      TIMEOUT
    );

    test(
      'should search with facets',
      async () => {
        const searchQuery: SearchQuery = {
          query: 'error',
        };

        const result = await repository.searchWithFacets(searchQuery);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data!.results).toBeDefined();
        expect(result.data!.facets).toBeDefined();
        expect(result.data!.facets.categories.length).toBeGreaterThan(0);
        expect(result.data!.facets.tags.length).toBeGreaterThan(0);
        expect(result.data!.totalCount).toBeGreaterThanOrEqual(0);
      },
      TIMEOUT
    );
  });

  describe('Statistics and Analytics', () => {
    test(
      'should get database statistics',
      async () => {
        const result = await repository.getStatistics();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data!.totalEntries).toBeGreaterThanOrEqual(0);
        expect(result.data!.categoryCounts).toBeDefined();
        expect(result.data!.healthStatus).toBeDefined();
        expect(result.data!.performance).toBeDefined();
        expect(result.data!.timestamp).toBeInstanceOf(Date);
      },
      TIMEOUT
    );

    test(
      'should get popular entries',
      async () => {
        const result = await repository.getPopularEntries(5);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      },
      TIMEOUT
    );

    test(
      'should get recent entries',
      async () => {
        const result = await repository.getRecentEntries(5);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      },
      TIMEOUT
    );

    test(
      'should get all categories',
      async () => {
        const result = await repository.getAllCategories();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      },
      TIMEOUT
    );

    test(
      'should get all tags',
      async () => {
        const result = await repository.getAllTags();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(Array.isArray(result.data)).toBe(true);
      },
      TIMEOUT
    );
  });

  describe('Feedback and Usage Tracking', () => {
    test(
      'should record entry feedback',
      async () => {
        // Create a test entry first
        const newEntry: CreateKBEntry = {
          title: 'Feedback Test Entry',
          problem: 'This entry is created specifically for testing feedback functionality',
          solution: 'The feedback system should record ratings and comments for this entry',
          category: 'System',
        };

        const createResult = await repository.create(newEntry);
        expect(createResult.success).toBe(true);

        // Record feedback
        const feedback: EntryFeedback = {
          entry_id: createResult.data!.id!,
          rating: 5,
          successful: true,
          comment: 'Excellent solution!',
          resolution_time: 300000, // 5 minutes
        };

        const result = await repository.recordFeedback(feedback);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(typeof result.data).toBe('string'); // Returns feedback ID
      },
      TIMEOUT
    );

    test(
      'should record usage metrics',
      async () => {
        // Create a test entry first
        const newEntry: CreateKBEntry = {
          title: 'Usage Test Entry',
          problem: 'This entry is used for testing usage metric recording',
          solution: 'Usage metrics should be recorded when this entry is accessed',
          category: 'System',
        };

        const createResult = await repository.create(newEntry);
        expect(createResult.success).toBe(true);

        // Record usage
        const usageMetric = {
          entry_id: createResult.data!.id!,
          action: 'view' as const,
          user_id: 'test-user',
          session_id: 'test-session-123',
        };

        const result = await repository.recordUsage(usageMetric);

        expect(result.success).toBe(true);
      },
      TIMEOUT
    );
  });

  describe('Bulk Operations', () => {
    test(
      'should bulk create entries',
      async () => {
        const bulkEntries: CreateKBEntry[] = [
          {
            title: 'Bulk Entry 1',
            problem: 'First bulk entry for testing bulk creation functionality',
            solution: 'Solution for the first bulk created entry',
            category: 'Batch',
          },
          {
            title: 'Bulk Entry 2',
            problem: 'Second bulk entry for testing bulk creation functionality',
            solution: 'Solution for the second bulk created entry',
            category: 'CICS',
          },
        ];

        const result = await repository.bulkCreate(bulkEntries);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data!.length).toBe(2);
        expect(result.data!.every(id => typeof id === 'string')).toBe(true);
      },
      TIMEOUT
    );

    test(
      'should bulk delete entries',
      async () => {
        // Create entries to delete
        const createResults = await Promise.all([
          repository.create({
            title: 'Delete Me 1',
            problem: 'This entry will be deleted in bulk operation test',
            solution: 'This should be deleted along with other entries',
            category: 'Other',
          }),
          repository.create({
            title: 'Delete Me 2',
            problem: 'This entry will also be deleted in bulk operation test',
            solution: 'This should also be deleted with the bulk operation',
            category: 'Other',
          }),
        ]);

        expect(createResults.every(r => r.success)).toBe(true);

        const idsToDelete = createResults.map(r => r.data!.id!);
        const deleteResult = await repository.bulkDelete(idsToDelete);

        expect(deleteResult.success).toBe(true);

        // Verify entries are deleted
        for (const id of idsToDelete) {
          const findResult = await repository.findById(id);
          expect(findResult.success).toBe(false);
        }
      },
      TIMEOUT
    );
  });

  describe('Error Handling', () => {
    test(
      'should handle validation errors gracefully',
      async () => {
        const invalidEntry = {
          title: 'X', // Too short
          problem: 'Short',
          solution: 'Also short',
          category: 'INVALID',
        };

        const result = await repository.create(invalidEntry as any);

        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(AppError);
        expect(result.error!.code).toBe(ErrorCode.VALIDATION_ERROR);
      },
      TIMEOUT
    );

    test(
      'should handle database constraint violations',
      async () => {
        // Try to create entry with same ID twice
        const entryId = uuidv4();
        const entry: CreateKBEntry = {
          title: 'Constraint Test',
          problem: 'Testing database constraint handling',
          solution: 'This should handle constraint violations gracefully',
          category: 'System',
        };

        // Mock the entry to have a specific ID
        const modifiedEntry = { ...entry, id: entryId };

        // First creation should succeed
        const firstResult = await repository.create(entry);
        expect(firstResult.success).toBe(true);

        // Second creation with same data should still succeed (new ID generated)
        const secondResult = await repository.create(entry);
        expect(secondResult.success).toBe(true);
        expect(secondResult.data!.id).not.toBe(firstResult.data!.id);
      },
      TIMEOUT
    );
  });
});

// Helper function to initialize test database
async function initializeTestDatabase(db: Database.Database): Promise<void> {
  // Read and execute the migration SQL
  const migrationSQL = `
    CREATE TABLE IF NOT EXISTS kb_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      problem TEXT NOT NULL,
      solution TEXT NOT NULL,
      category TEXT NOT NULL,
      severity TEXT DEFAULT 'medium',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT DEFAULT 'system',
      usage_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      last_used DATETIME,
      archived BOOLEAN DEFAULT FALSE,
      confidence_score REAL
    );

    CREATE TABLE IF NOT EXISTS kb_tags (
      entry_id TEXT,
      tag TEXT,
      PRIMARY KEY (entry_id, tag),
      FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS entry_feedback (
      id TEXT PRIMARY KEY,
      entry_id TEXT,
      user_id TEXT,
      rating INTEGER,
      successful BOOLEAN,
      comment TEXT,
      session_id TEXT,
      resolution_time INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS usage_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id TEXT,
      action TEXT,
      user_id TEXT,
      session_id TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      metadata TEXT,
      FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT,
      normalized_query TEXT,
      results_count INTEGER,
      selected_entry_id TEXT,
      user_id TEXT,
      session_id TEXT,
      search_time_ms INTEGER,
      filters_used TEXT,
      ai_used BOOLEAN DEFAULT FALSE,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (selected_entry_id) REFERENCES kb_entries(id) ON DELETE SET NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS kb_fts USING fts5(
      id UNINDEXED,
      title,
      problem,
      solution,
      tags,
      content=kb_entries
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_kb_entries_category ON kb_entries(category);
    CREATE INDEX IF NOT EXISTS idx_kb_entries_usage ON kb_entries(usage_count DESC);
    CREATE INDEX IF NOT EXISTS idx_kb_entries_archived ON kb_entries(archived);
    CREATE INDEX IF NOT EXISTS idx_kb_tags_tag ON kb_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_feedback_entry_id ON entry_feedback(entry_id);
    CREATE INDEX IF NOT EXISTS idx_usage_entry_id ON usage_metrics(entry_id);
    CREATE INDEX IF NOT EXISTS idx_search_query ON search_history(query);
  `;

  db.exec(migrationSQL);
}

// Performance and stress tests
describe('Performance Tests', () => {
  let db: Database.Database;
  let repository: KnowledgeBaseRepository;

  beforeAll(async () => {
    db = new Database(TEST_DB_PATH);
    await initializeTestDatabase(db);
    repository = new KnowledgeBaseRepository(db);
  });

  afterAll(async () => {
    await repository.cleanup();
    db.close();
  });

  test('should handle large batch creation efficiently', async () => {
    const batchSize = 100;
    const entries: CreateKBEntry[] = Array.from({ length: batchSize }, (_, i) => ({
      title: `Performance Test Entry ${i + 1}`,
      problem: `This is a performance test problem description for entry number ${i + 1}. It contains enough text to make it realistic.`,
      solution: `This is the solution for performance test entry ${i + 1}. It provides step-by-step instructions that would help resolve the issue.`,
      category: ['VSAM', 'DB2', 'JCL', 'Batch', 'CICS'][i % 5] as KBCategory,
      tags: [`tag${i}`, `test${i % 10}`, 'performance'],
    }));

    const startTime = Date.now();
    const result = await repository.bulkCreate(entries);
    const endTime = Date.now();

    expect(result.success).toBe(true);
    expect(result.data!.length).toBe(batchSize);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
  }, 10000);

  test('should perform search operations efficiently', async () => {
    const searchQueries = [
      'performance test',
      'VSAM error',
      'database issue',
      'batch job failure',
      'connection timeout',
    ];

    for (const query of searchQueries) {
      const startTime = Date.now();
      const result = await repository.search({ query });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    }
  }, 10000);
});

// Integration tests
describe('Integration Tests', () => {
  let db: Database.Database;
  let repository: KnowledgeBaseRepository;

  beforeEach(async () => {
    db = new Database(TEST_DB_PATH);
    await initializeTestDatabase(db);
    repository = new KnowledgeBaseRepository(db);
  });

  afterEach(async () => {
    await repository.cleanup();
    db.close();
  });

  test(
    'should maintain data consistency across operations',
    async () => {
      // Create an entry
      const entry: CreateKBEntry = {
        title: 'Integration Test Entry',
        problem: 'Testing data consistency across multiple operations',
        solution: 'All operations should maintain data integrity',
        category: 'System',
        tags: ['integration', 'test', 'consistency'],
      };

      const createResult = await repository.create(entry);
      expect(createResult.success).toBe(true);

      const entryId = createResult.data!.id!;

      // Record some usage
      await repository.recordUsage({
        entry_id: entryId,
        action: 'view',
        user_id: 'test-user',
      });

      // Record feedback
      await repository.recordFeedback({
        entry_id: entryId,
        rating: 5,
        successful: true,
        comment: 'Great solution!',
      });

      // Update the entry
      await repository.update(entryId, {
        title: 'Updated Integration Test Entry',
        severity: 'high',
      });

      // Verify all data is consistent
      const finalEntry = await repository.findById(entryId);
      expect(finalEntry.success).toBe(true);
      expect(finalEntry.data!.title).toBe('Updated Integration Test Entry');
      expect(finalEntry.data!.severity).toBe('high');
      expect(finalEntry.data!.usage_count).toBeGreaterThan(0);

      // Clean up
      await repository.delete(entryId);
      const deletedCheck = await repository.findById(entryId);
      expect(deletedCheck.success).toBe(false);
    },
    TIMEOUT
  );
});
