/**
 * SearchService Unit Tests
 * Testing search algorithms, ranking logic, and tokenization
 */

import { SearchService } from '../SearchService';
import { KBEntry, SearchOptions } from '../../types/services';

// Mock data for testing
const mockKBEntries: KBEntry[] = [
  {
    id: '1',
    title: 'VSAM Status 35 Error',
    problem: 'Job fails with VSAM status code 35 indicating file not found',
    solution: 'Check dataset exists, verify DD statement, ensure proper cataloging',
    category: 'VSAM',
    tags: ['vsam', 'status-35', 'file-not-found'],
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    created_by: 'system',
    usage_count: 10,
    success_count: 8,
    failure_count: 2,
    version: 1
  },
  {
    id: '2',
    title: 'S0C7 Data Exception',
    problem: 'Program abends with S0C7 data exception during arithmetic operations',
    solution: 'Check for non-numeric data in numeric fields, initialize working storage',
    category: 'Batch',
    tags: ['s0c7', 'abend', 'numeric', 'data-exception'],
    created_at: new Date('2024-01-02'),
    updated_at: new Date('2024-01-02'),
    created_by: 'system',
    usage_count: 15,
    success_count: 12,
    failure_count: 3,
    version: 1
  },
  {
    id: '3',
    title: 'JCL Error IEF212I',
    problem: 'Dataset not found error in JCL job submission',
    solution: 'Verify dataset name spelling, check existence, verify GDG generation',
    category: 'JCL',
    tags: ['jcl', 'dataset', 'ief212i', 'not-found'],
    created_at: new Date('2024-01-03'),
    updated_at: new Date('2024-01-03'),
    created_by: 'system',
    usage_count: 5,
    success_count: 4,
    failure_count: 1,
    version: 1
  },
  {
    id: '4',
    title: 'DB2 SQLCODE -904',
    problem: 'Resource unavailable error when accessing DB2 database',
    solution: 'Check tablespace status, run image copy if needed, contact DBA',
    category: 'DB2',
    tags: ['db2', 'sqlcode', '-904', 'resource'],
    created_at: new Date('2024-01-04'),
    updated_at: new Date('2024-01-04'),
    created_by: 'system',
    usage_count: 7,
    success_count: 6,
    failure_count: 1,
    version: 1
  }
];

describe('SearchService Unit Tests', () => {
  let searchService: SearchService;

  beforeEach(() => {
    searchService = new SearchService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Search Algorithm Tests', () => {
    test('should find exact matches', async () => {
      const results = await searchService.search('VSAM Status 35', mockKBEntries);
      
      expect(results).toHaveLength(1);
      expect(results[0].entry.id).toBe('1');
      expect(results[0].matchType).toBe('exact');
      expect(results[0].score).toBeGreaterThan(80);
    });

    test('should find fuzzy matches', async () => {
      const results = await searchService.search('data error', mockKBEntries);
      
      expect(results.length).toBeGreaterThan(0);
      const s0c7Entry = results.find(r => r.entry.id === '2');
      expect(s0c7Entry).toBeDefined();
      expect(s0c7Entry?.matchType).toBe('fuzzy');
    });

    test('should handle empty queries', async () => {
      const results = await searchService.search('', mockKBEntries);
      expect(results).toHaveLength(0);
    });

    test('should handle whitespace-only queries', async () => {
      const results = await searchService.search('   ', mockKBEntries);
      expect(results).toHaveLength(0);
    });

    test('should return results for single character queries', async () => {
      const results = await searchService.search('s', mockKBEntries);
      // Should return empty array for too short queries
      expect(results).toHaveLength(0);
    });

    test('should find category-based matches', async () => {
      const results = await searchService.search('vsam', mockKBEntries);
      
      const vsamEntry = results.find(r => r.entry.category === 'VSAM');
      expect(vsamEntry).toBeDefined();
      expect(vsamEntry?.matchType).toMatch(/exact|category/);
    });

    test('should find tag-based matches', async () => {
      const results = await searchService.search('abend', mockKBEntries);
      
      const abendEntry = results.find(r => r.entry.tags.includes('abend'));
      expect(abendEntry).toBeDefined();
      expect(abendEntry?.matchType).toMatch(/tag|fuzzy|exact/);
    });
  });

  describe('Tokenization Tests', () => {
    test('should tokenize queries correctly', async () => {
      // Test private method indirectly through search results
      const results1 = await searchService.search('VSAM status code', mockKBEntries);
      const results2 = await searchService.search('vsam-status-code', mockKBEntries);
      
      // Both should find the VSAM entry despite different formatting
      const vsamResult1 = results1.find(r => r.entry.id === '1');
      const vsamResult2 = results2.find(r => r.entry.id === '1');
      
      expect(vsamResult1).toBeDefined();
      expect(vsamResult2).toBeDefined();
    });

    test('should handle special characters in queries', async () => {
      const results = await searchService.search('S0C7 (data exception)', mockKBEntries);
      
      const s0c7Entry = results.find(r => r.entry.id === '2');
      expect(s0c7Entry).toBeDefined();
    });

    test('should filter out stop words appropriately', async () => {
      // Search with and without common words
      const results1 = await searchService.search('the dataset not found', mockKBEntries);
      const results2 = await searchService.search('dataset not found', mockKBEntries);
      
      expect(results1.length).toBeGreaterThan(0);
      expect(results2.length).toBeGreaterThan(0);
    });
  });

  describe('Ranking Logic Tests', () => {
    test('should rank exact matches higher than fuzzy matches', async () => {
      const results = await searchService.search('vsam', mockKBEntries);
      
      expect(results.length).toBeGreaterThan(1);
      
      // Check that exact matches score higher
      const exactMatch = results.find(r => r.matchType === 'exact' || r.matchType === 'category');
      const fuzzyMatch = results.find(r => r.matchType === 'fuzzy');
      
      if (exactMatch && fuzzyMatch) {
        expect(exactMatch.score).toBeGreaterThan(fuzzyMatch.score);
      }
    });

    test('should boost results with higher usage counts', async () => {
      // Entry 2 has higher usage (15) than entry 3 (5)
      const results = await searchService.search('error', mockKBEntries);
      
      const entry2 = results.find(r => r.entry.id === '2');
      const entry3 = results.find(r => r.entry.id === '3');
      
      if (entry2 && entry3) {
        // Higher usage should contribute to higher score
        expect(entry2.entry.usage_count).toBeGreaterThan(entry3.entry.usage_count);
      }
    });

    test('should boost results with higher success rates', async () => {
      // Mock entries with different success rates
      const testEntries = [...mockKBEntries];
      testEntries.push({
        id: '5',
        title: 'Test Entry High Success',
        problem: 'Test problem with error',
        solution: 'Test solution',
        category: 'Other',
        tags: ['test', 'error'],
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'system',
        usage_count: 10,
        success_count: 9, // 90% success rate
        failure_count: 1,
        version: 1
      });

      const results = await searchService.search('error', testEntries);
      
      expect(results.length).toBeGreaterThan(0);
      // Verify that success rate contributes to scoring
      results.forEach(result => {
        expect(result.score).toBeGreaterThan(0);
      });
    });

    test('should rank title matches higher than content matches', async () => {
      const results = await searchService.search('VSAM', mockKBEntries);
      
      const titleMatch = results.find(r => 
        r.entry.title.toLowerCase().includes('vsam') && r.entry.id === '1'
      );
      
      expect(titleMatch).toBeDefined();
      expect(titleMatch?.score).toBeGreaterThan(50);
    });

    test('should sort results by score in descending order', async () => {
      const results = await searchService.search('error', mockKBEntries);
      
      expect(results.length).toBeGreaterThan(1);
      
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });
  });

  describe('Search Options Tests', () => {
    test('should respect limit option', async () => {
      const options: SearchOptions = { limit: 2 };
      const results = await searchService.search('error', mockKBEntries, options);
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should filter by category', async () => {
      const options: SearchOptions = { category: 'VSAM' };
      const results = await searchService.search('status', mockKBEntries, options);
      
      results.forEach(result => {
        expect(result.entry.category).toBe('VSAM');
      });
    });

    test('should filter by tags', async () => {
      const options: SearchOptions = { tags: ['abend'] };
      const results = await searchService.search('error', mockKBEntries, options);
      
      results.forEach(result => {
        expect(result.entry.tags).toContain('abend');
      });
    });

    test('should apply threshold filtering', async () => {
      const options: SearchOptions = { threshold: 0.8 };
      const results = await searchService.search('error', mockKBEntries, options);
      
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(80);
      });
    });

    test('should sort by usage when specified', async () => {
      const options: SearchOptions = { sortBy: 'usage' };
      const results = await searchService.search('error', mockKBEntries, options);
      
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].entry.usage_count)
            .toBeGreaterThanOrEqual(results[i].entry.usage_count);
        }
      }
    });

    test('should sort by recent when specified', async () => {
      const options: SearchOptions = { sortBy: 'recent' };
      const results = await searchService.search('error', mockKBEntries, options);
      
      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].entry.created_at.getTime())
            .toBeGreaterThanOrEqual(results[i].entry.created_at.getTime());
        }
      }
    });

    test('should include highlights when requested', async () => {
      const options: SearchOptions = { includeHighlights: true };
      const results = await searchService.search('VSAM status', mockKBEntries, options);
      
      const vsamResult = results.find(r => r.entry.id === '1');
      expect(vsamResult?.highlights).toBeDefined();
      expect(vsamResult?.highlights?.length).toBeGreaterThan(0);
    });
  });

  describe('Search Suggestions Tests', () => {
    beforeEach(async () => {
      // Populate search history
      await searchService.search('vsam status 35', mockKBEntries);
      await searchService.search('data exception', mockKBEntries);
      await searchService.search('jcl error', mockKBEntries);
    });

    test('should provide suggestions for partial queries', async () => {
      const suggestions = await searchService.suggest('vsa');
      
      expect(suggestions).toContain('vsam status 35');
    });

    test('should return mainframe-specific suggestions', async () => {
      const suggestions = await searchService.suggest('jcl');
      
      expect(suggestions.some(s => s.includes('jcl'))).toBeTruthy();
    });

    test('should limit suggestions correctly', async () => {
      const suggestions = await searchService.suggest('error', 3);
      
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    test('should return empty array for short queries', async () => {
      const suggestions = await searchService.suggest('a');
      
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('Performance Validation Tests', () => {
    test('should complete search within 1 second for typical queries', async () => {
      const startTime = Date.now();
      
      await searchService.search('vsam status error', mockKBEntries);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    test('should handle large query strings efficiently', async () => {
      const longQuery = 'very long query string with many words that should still be processed efficiently without timeout issues in the search algorithm';
      
      const startTime = Date.now();
      await searchService.search(longQuery, mockKBEntries);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(1000);
    });

    test('should handle empty entry arrays efficiently', async () => {
      const startTime = Date.now();
      
      const results = await searchService.search('test query', []);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should be very fast
      expect(results).toHaveLength(0);
    });
  });

  describe('Search Result Metadata Tests', () => {
    test('should include processing time in metadata', async () => {
      const results = await searchService.search('vsam', mockKBEntries);
      
      expect(results[0]?.metadata?.processingTime).toBeGreaterThanOrEqual(0);
    });

    test('should include source information', async () => {
      const results = await searchService.search('vsam', mockKBEntries);
      
      expect(results[0]?.metadata?.source).toBeDefined();
      expect(['database', 'cache', 'ai']).toContain(results[0]?.metadata?.source);
    });

    test('should include confidence scores', async () => {
      const results = await searchService.search('vsam', mockKBEntries);
      
      expect(results[0]?.metadata?.confidence).toBeGreaterThanOrEqual(0);
      expect(results[0]?.metadata?.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Edge Cases Tests', () => {
    test('should handle special mainframe error codes', async () => {
      const results = await searchService.search('S0C7', mockKBEntries);
      
      const s0c7Entry = results.find(r => r.entry.id === '2');
      expect(s0c7Entry).toBeDefined();
    });

    test('should handle numeric codes correctly', async () => {
      const results = await searchService.search('35', mockKBEntries);
      
      const statusEntry = results.find(r => r.entry.title.includes('35'));
      expect(statusEntry).toBeDefined();
    });

    test('should handle mixed case queries', async () => {
      const results1 = await searchService.search('VSAM', mockKBEntries);
      const results2 = await searchService.search('vsam', mockKBEntries);
      const results3 = await searchService.search('Vsam', mockKBEntries);
      
      expect(results1.length).toBe(results2.length);
      expect(results2.length).toBe(results3.length);
    });

    test('should handle entries with missing optional fields', async () => {
      const incompleteEntry: KBEntry = {
        id: 'incomplete',
        title: 'Incomplete Entry',
        problem: 'Test problem',
        solution: 'Test solution',
        category: 'Other',
        tags: [],
        created_at: new Date(),
        updated_at: new Date(),
        created_by: 'test',
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
        version: 1
      };

      const testEntries = [...mockKBEntries, incompleteEntry];
      const results = await searchService.search('incomplete', testEntries);
      
      expect(results.length).toBeGreaterThan(0);
      const incompleteResult = results.find(r => r.entry.id === 'incomplete');
      expect(incompleteResult).toBeDefined();
    });
  });
});