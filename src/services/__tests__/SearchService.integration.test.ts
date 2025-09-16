/**
 * SearchService Integration Tests
 * Testing API endpoints, database integration, and cache integration
 */

import { SearchService } from '../SearchService';
import { KnowledgeDB } from '../../database/KnowledgeDB';
import { KBEntry, SearchOptions, GeminiConfig } from '../../types/services';
import fs from 'fs';
import path from 'path';

// Integration test configuration
const TEST_DB_PATH = ':memory:'; // Use in-memory DB for tests
const MOCK_GEMINI_CONFIG: GeminiConfig = {
  apiKey: 'test-api-key',
  model: 'gemini-pro',
  temperature: 0.3,
  maxTokens: 1024,
  timeout: 5000,
  rateLimit: {
    requests: 100,
    window: 60000
  }
};

describe('SearchService Integration Tests', () => {
  let searchService: SearchService;
  let knowledgeDB: KnowledgeDB;
  let testEntries: KBEntry[];

  beforeAll(async () => {
    // Initialize database
    knowledgeDB = new KnowledgeDB(TEST_DB_PATH);
    await knowledgeDB.initialize();

    // Initialize search service
    searchService = new SearchService(MOCK_GEMINI_CONFIG);

    // Create test entries
    testEntries = await createTestEntries();
  });

  afterAll(async () => {
    await knowledgeDB.close();
  });

  beforeEach(async () => {
    // Clear and repopulate test data
    await clearTestData();
    testEntries = await createTestEntries();
  });

  async function createTestEntries(): Promise<KBEntry[]> {
    const entries = [
      {
        title: 'VSAM Status 35 - File Not Found',
        problem: 'Job abends with VSAM status code 35. The program cannot open the VSAM file.',
        solution: '1. Verify dataset exists using ISPF 3.4\n2. Check DD statement in JCL\n3. Ensure file is cataloged properly',
        category: 'VSAM' as const,
        tags: ['vsam', 'status-35', 'file-not-found', 'catalog'],
        created_by: 'system'
      },
      {
        title: 'S0C7 Data Exception in COBOL',
        problem: 'Program abends with S0C7 data exception during arithmetic operations or MOVE statements.',
        solution: '1. Check for non-numeric data in numeric fields\n2. Initialize working storage properly\n3. Use NUMPROC(NOPFD) compile option',
        category: 'Batch' as const,
        tags: ['s0c7', 'data-exception', 'numeric', 'abend', 'cobol'],
        created_by: 'system'
      },
      {
        title: 'JCL Error IEF212I Dataset Not Found',
        problem: 'JCL fails with IEF212I dataset not found error during job submission.',
        solution: '1. Verify dataset name spelling\n2. Check if dataset exists\n3. Verify GDG generation number',
        category: 'JCL' as const,
        tags: ['jcl', 'dataset', 'ief212i', 'not-found', 'allocation'],
        created_by: 'system'
      },
      {
        title: 'DB2 SQLCODE -904 Resource Unavailable',
        problem: 'Program receives SQLCODE -904 indicating database resource is unavailable.',
        solution: '1. Check database status\n2. Run IMAGE COPY if needed\n3. Contact DBA for tablespace issues',
        category: 'DB2' as const,
        tags: ['db2', 'sqlcode', '-904', 'resource', 'unavailable'],
        created_by: 'system'
      },
      {
        title: 'CICS ASRA Program Check',
        problem: 'CICS transaction abends with ASRA indicating program check (0C4, 0C7, etc).',
        solution: '1. Check CEDF for exact offset\n2. Review compile listing\n3. Check for storage violations',
        category: 'Other' as const,
        tags: ['cics', 'asra', 'abend', 'program-check'],
        created_by: 'system'
      }
    ];

    const createdEntries: KBEntry[] = [];
    for (const entry of entries) {
      const id = await knowledgeDB.addEntry(entry);
      const fullEntry = await knowledgeDB.getEntry(id);
      if (fullEntry) {
        createdEntries.push(fullEntry);
      }
    }

    return createdEntries;
  }

  async function clearTestData(): Promise<void> {
    // Clear all test data from database
    const entries = await knowledgeDB.getAllEntries();
    for (const entry of entries) {
      await knowledgeDB.deleteEntry(entry.id);
    }
  }

  describe('Database Integration Tests', () => {
    test('should search entries from database correctly', async () => {
      const results = await searchService.search('VSAM status', testEntries);
      
      expect(results.length).toBeGreaterThan(0);
      const vsamEntry = results.find(r => r.entry.category === 'VSAM');
      expect(vsamEntry).toBeDefined();
      expect(vsamEntry?.entry.title).toContain('VSAM Status 35');
    });

    test('should handle database entries with special characters', async () => {
      // Add entry with special characters
      const specialEntry = await knowledgeDB.addEntry({
        title: 'Special Characters & Symbols Test',
        problem: 'Testing special chars: @#$%^&*()_+{}[]|\\:";\'<>?,./',
        solution: 'Handle special characters properly in search',
        category: 'Other',
        tags: ['special', 'chars', 'test'],
        created_by: 'test'
      });

      const fullEntry = await knowledgeDB.getEntry(specialEntry);
      if (fullEntry) {
        const allEntries = [...testEntries, fullEntry];
        const results = await searchService.search('special characters', allEntries);
        
        expect(results.length).toBeGreaterThan(0);
        const specialResult = results.find(r => r.entry.id === specialEntry);
        expect(specialResult).toBeDefined();
      }
    });

    test('should search across all entry fields', async () => {
      // Search for content in problem field
      const problemResults = await searchService.search('arithmetic operations', testEntries);
      expect(problemResults.length).toBeGreaterThan(0);

      // Search for content in solution field
      const solutionResults = await searchService.search('working storage', testEntries);
      expect(solutionResults.length).toBeGreaterThan(0);

      // Search for tags
      const tagResults = await searchService.search('abend', testEntries);
      expect(tagResults.length).toBeGreaterThan(0);
    });

    test('should respect database transaction integrity', async () => {
      const originalCount = testEntries.length;
      
      // Add new entry
      const newEntryId = await knowledgeDB.addEntry({
        title: 'Transaction Test Entry',
        problem: 'Testing transaction integrity',
        solution: 'Ensure ACID properties',
        category: 'Other',
        tags: ['transaction', 'test'],
        created_by: 'test'
      });

      const newEntry = await knowledgeDB.getEntry(newEntryId);
      expect(newEntry).toBeDefined();
      
      const updatedEntries = await knowledgeDB.getAllEntries();
      expect(updatedEntries.length).toBe(originalCount + 1);
    });
  });

  describe('Search Index Integration Tests', () => {
    test('should build and use search index correctly', async () => {
      // Build index
      await searchService.buildIndex(testEntries);
      
      // Perform search
      const results = await searchService.search('error', testEntries);
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.score).toBeGreaterThan(0);
        expect(result.entry).toBeDefined();
      });
    });

    test('should handle index optimization', async () => {
      await searchService.buildIndex(testEntries);
      
      // Should not throw error
      await expect(searchService.optimizeIndex()).resolves.not.toThrow();
    });

    test('should update index when new entries are added', async () => {
      // Initial index
      await searchService.buildIndex(testEntries);
      
      // Add new entry
      const newEntry = await knowledgeDB.addEntry({
        title: 'New Index Test Entry',
        problem: 'Testing index updates',
        solution: 'Index should include new entries',
        category: 'Other',
        tags: ['index', 'update', 'test'],
        created_by: 'test'
      });

      const fullNewEntry = await knowledgeDB.getEntry(newEntry);
      if (fullNewEntry) {
        const updatedEntries = [...testEntries, fullNewEntry];
        await searchService.buildIndex(updatedEntries);
        
        const results = await searchService.search('index test', updatedEntries);
        const newResult = results.find(r => r.entry.id === newEntry);
        expect(newResult).toBeDefined();
      }
    });
  });

  describe('Cache Integration Tests', () => {
    test('should cache search results for repeated queries', async () => {
      const query = 'VSAM status error';
      
      // First search - should hit database
      const startTime1 = Date.now();
      const results1 = await searchService.search(query, testEntries);
      const duration1 = Date.now() - startTime1;
      
      // Second search - should potentially use cache
      const startTime2 = Date.now();
      const results2 = await searchService.search(query, testEntries);
      const duration2 = Date.now() - startTime2;
      
      expect(results1.length).toBe(results2.length);
      expect(results1[0]?.entry.id).toBe(results2[0]?.entry.id);
      
      // Cache should improve performance or at least not degrade it
      expect(duration2).toBeLessThanOrEqual(duration1 + 50); // Allow for variance
    });

    test('should handle cache invalidation properly', async () => {
      const query = 'test cache invalidation';
      
      // Initial search
      const results1 = await searchService.search(query, testEntries);
      
      // Add new entry that matches the query
      const newEntryId = await knowledgeDB.addEntry({
        title: 'Cache Invalidation Test',
        problem: 'Test cache invalidation when new entries are added',
        solution: 'Cache should be invalidated or updated',
        category: 'Other',
        tags: ['cache', 'invalidation', 'test'],
        created_by: 'test'
      });

      const newEntry = await knowledgeDB.getEntry(newEntryId);
      if (newEntry) {
        const updatedEntries = [...testEntries, newEntry];
        
        // Search with updated entries
        const results2 = await searchService.search(query, updatedEntries);
        
        // Should include the new entry
        expect(results2.length).toBeGreaterThanOrEqual(results1.length);
        const newResult = results2.find(r => r.entry.id === newEntryId);
        expect(newResult).toBeDefined();
      }
    });
  });

  describe('AI Service Integration Tests', () => {
    test('should handle AI service unavailable gracefully', async () => {
      // Test with invalid API key to simulate service unavailable
      const serviceWithBadConfig = new SearchService({
        ...MOCK_GEMINI_CONFIG,
        apiKey: 'invalid-key'
      });

      const results = await serviceWithBadConfig.search('test query', testEntries, { useAI: true });
      
      // Should fallback to local search
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBeTruthy();
    });

    test('should handle AI timeout gracefully', async () => {
      const serviceWithTimeout = new SearchService({
        ...MOCK_GEMINI_CONFIG,
        timeout: 1 // Very short timeout
      });

      const results = await serviceWithTimeout.search('complex query', testEntries, { useAI: true });
      
      // Should fallback to local search
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBeTruthy();
    });

    test('should work without AI configuration', async () => {
      const serviceWithoutAI = new SearchService();
      
      const results = await serviceWithoutAI.search('test query', testEntries);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Search History Integration Tests', () => {
    test('should record search history correctly', async () => {
      const query1 = 'first search query';
      const query2 = 'second search query';
      
      await searchService.search(query1, testEntries);
      await searchService.search(query2, testEntries);
      
      const recentSearches = await searchService.getRecentSearches(10);
      
      expect(recentSearches.length).toBeGreaterThanOrEqual(2);
      expect(recentSearches.some(s => s.text === query1)).toBeTruthy();
      expect(recentSearches.some(s => s.text === query2)).toBeTruthy();
    });

    test('should track popular searches', async () => {
      const popularQuery = 'popular search';
      
      // Perform the same search multiple times
      for (let i = 0; i < 5; i++) {
        await searchService.search(popularQuery, testEntries);
      }
      
      const popularSearches = await searchService.getPopularSearches(10);
      const popularResult = popularSearches.find(p => p.query === popularQuery);
      
      expect(popularResult).toBeDefined();
      expect(popularResult?.count).toBeGreaterThanOrEqual(5);
    });

    test('should provide search suggestions based on history', async () => {
      // Perform some searches to build history
      await searchService.search('vsam status error', testEntries);
      await searchService.search('vsam file not found', testEntries);
      await searchService.search('data exception abend', testEntries);
      
      const suggestions = await searchService.suggest('vsam');
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('vsam'))).toBeTruthy();
    });
  });

  describe('Error Handling Integration Tests', () => {
    test('should handle database connection errors gracefully', async () => {
      // Simulate database connection issue by closing the database
      await knowledgeDB.close();
      
      // Search should still work with provided entries
      const results = await searchService.search('test query', testEntries);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBeTruthy();
      
      // Reinitialize database for other tests
      knowledgeDB = new KnowledgeDB(TEST_DB_PATH);
      await knowledgeDB.initialize();
    });

    test('should handle malformed search options gracefully', async () => {
      const malformedOptions = {
        limit: -1,
        threshold: 2.0, // Invalid threshold > 1
        category: 'INVALID_CATEGORY' as any,
        sortBy: 'invalid_sort' as any
      };

      await expect(
        searchService.search('test query', testEntries, malformedOptions)
      ).resolves.not.toThrow();
    });

    test('should handle empty or null entry arrays', async () => {
      const results1 = await searchService.search('test', []);
      expect(results1).toHaveLength(0);

      const results2 = await searchService.search('test', null as any);
      expect(results2).toHaveLength(0);
    });
  });

  describe('Performance Integration Tests', () => {
    test('should complete database search within performance requirements', async () => {
      const startTime = Date.now();
      
      const results = await searchService.search('performance test query', testEntries);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Less than 1 second
      expect(results).toBeDefined();
    });

    test('should handle large result sets efficiently', async () => {
      // Search for common term that matches multiple entries
      const startTime = Date.now();
      
      const results = await searchService.search('error', testEntries);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should scale with database size', async () => {
      // Add more entries to test scaling
      const additionalEntries = [];
      for (let i = 0; i < 50; i++) {
        const entryId = await knowledgeDB.addEntry({
          title: `Scale Test Entry ${i}`,
          problem: `Test problem ${i} for scaling performance`,
          solution: `Test solution ${i}`,
          category: 'Other',
          tags: [`scale-${i}`, 'performance', 'test'],
          created_by: 'test'
        });
        
        const entry = await knowledgeDB.getEntry(entryId);
        if (entry) {
          additionalEntries.push(entry);
        }
      }

      const allEntries = [...testEntries, ...additionalEntries];
      
      const startTime = Date.now();
      const results = await searchService.search('performance', allEntries);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(2000); // Allow more time for larger dataset
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Search Explanation Integration Tests', () => {
    test('should provide search explanations', async () => {
      const results = await searchService.search('vsam status', testEntries);
      
      if (results.length > 0) {
        const explanation = await searchService.explain('vsam status', results[0]);
        
        expect(explanation).toBeDefined();
        expect(typeof explanation).toBe('string');
        expect(explanation.length).toBeGreaterThan(0);
      }
    });

    test('should explain different match types', async () => {
      const exactResults = await searchService.search('VSAM Status 35', testEntries);
      const fuzzyResults = await searchService.search('vsm stat', testEntries);
      
      if (exactResults.length > 0) {
        const exactExplanation = await searchService.explain('VSAM Status 35', exactResults[0]);
        expect(exactExplanation).toContain('match');
      }
      
      if (fuzzyResults.length > 0) {
        const fuzzyExplanation = await searchService.explain('vsm stat', fuzzyResults[0]);
        expect(fuzzyExplanation).toBeDefined();
      }
    });
  });
});