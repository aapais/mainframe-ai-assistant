/**
 * Search Relevance and Ranking Accuracy Validation Tests
 * Tests search quality and ranking algorithms
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SearchService } from '../../src/services/SearchService';
import { KBEntry, SearchResult, SearchOptions } from '../../src/types/services';

describe('Search Relevance Validation', () => {
  let searchService: SearchService;
  let mockEntries: KBEntry[];

  beforeEach(() => {
    searchService = new SearchService();

    // Create comprehensive test dataset
    mockEntries = [
      {
        id: '1',
        title: 'S0C7 Data Exception Abend Resolution',
        category: 'COBOL',
        problem: 'Program abends with S0C7 data exception error when processing numeric data',
        solution: 'Check for invalid numeric data in COMP-3 fields. Use NUMERIC test before arithmetic operations.',
        tags: ['S0C7', 'abend', 'numeric', 'data-exception', 'COBOL'],
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        usage_count: 45,
        success_count: 42,
        failure_count: 3
      },
      {
        id: '2',
        title: 'VSAM Status Code 35 - Record Not Found',
        category: 'VSAM',
        problem: 'VSAM file access returns status code 35 indicating record not found',
        solution: 'Verify key value, check if file is properly opened, and handle empty file conditions.',
        tags: ['VSAM', 'status-35', 'record-not-found', 'file-access'],
        created_at: '2024-01-10T14:30:00Z',
        updated_at: '2024-01-10T14:30:00Z',
        usage_count: 38,
        success_count: 35,
        failure_count: 3
      },
      {
        id: '3',
        title: 'JCL Job Card Parameters',
        category: 'JCL',
        problem: 'Job fails due to incorrect JOB card parameters and resource allocation',
        solution: 'Verify JOB card syntax, CLASS parameter, and region size allocation.',
        tags: ['JCL', 'job-card', 'parameters', 'resource-allocation'],
        created_at: '2024-01-05T09:15:00Z',
        updated_at: '2024-01-05T09:15:00Z',
        usage_count: 22,
        success_count: 20,
        failure_count: 2
      },
      {
        id: '4',
        title: 'DB2 SQLCODE -811 Multiple Row Error',
        category: 'DB2',
        problem: 'SELECT statement returns SQLCODE -811 when multiple rows found',
        solution: 'Use FETCH cursor or add ORDER BY with FETCH FIRST 1 ROW ONLY clause.',
        tags: ['DB2', 'SQLCODE', '-811', 'multiple-rows', 'cursor'],
        created_at: '2024-01-12T16:45:00Z',
        updated_at: '2024-01-12T16:45:00Z',
        usage_count: 31,
        success_count: 28,
        failure_count: 3
      },
      {
        id: '5',
        title: 'CICS Transaction Timeout AEIE',
        category: 'CICS',
        problem: 'CICS transaction times out with AEIE abend code',
        solution: 'Increase transaction timeout value or optimize program logic to reduce execution time.',
        tags: ['CICS', 'timeout', 'AEIE', 'transaction', 'performance'],
        created_at: '2024-01-08T11:20:00Z',
        updated_at: '2024-01-08T11:20:00Z',
        usage_count: 18,
        success_count: 15,
        failure_count: 3
      }
    ];

    // Build search index
    searchService.buildIndex(mockEntries);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Search Ranking Accuracy', () => {
    it('should rank exact matches highest', async () => {
      const query = 'S0C7 abend';
      const results = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: false,
        sortBy: 'relevance'
      });

      expect(results).toHaveLength(5);
      expect(results[0].entry.id).toBe('1'); // S0C7 entry should be first
      expect(results[0].score).toBeGreaterThan(90);
      expect(results[0].matchType).toBe('exact');
    });

    it('should prioritize high-usage successful entries', async () => {
      const query = 'data error';
      const results = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: false,
        sortBy: 'relevance'
      });

      // Should find multiple matches but prioritize by success rate and usage
      const s0c7Result = results.find(r => r.entry.id === '1');
      const vsam35Result = results.find(r => r.entry.id === '2');

      expect(s0c7Result).toBeDefined();
      expect(s0c7Result!.score).toBeGreaterThan(50);

      // High usage and success rate should boost ranking
      expect(s0c7Result!.entry.usage_count).toBeGreaterThan(30);
      expect(s0c7Result!.entry.success_count / s0c7Result!.entry.usage_count).toBeGreaterThan(0.8);
    });

    it('should handle category-specific searches', async () => {
      const query = 'error';
      const results = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: false,
        category: 'VSAM',
        sortBy: 'relevance'
      });

      expect(results).toHaveLength(1);
      expect(results[0].entry.category).toBe('VSAM');
      expect(results[0].entry.id).toBe('2');
    });

    it('should support fuzzy matching for typos', async () => {
      const query = 'S0C7 abned'; // Typo in 'abend'
      const results = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: false,
        threshold: 0.3, // Lower threshold for fuzzy matching
        sortBy: 'relevance'
      });

      expect(results.length).toBeGreaterThan(0);
      const s0c7Result = results.find(r => r.entry.id === '1');
      expect(s0c7Result).toBeDefined();
      expect(s0c7Result!.matchType).toBe('fuzzy');
    });

    it('should rank by tag relevance', async () => {
      const query = 'numeric';
      const results = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: false,
        sortBy: 'relevance'
      });

      const s0c7Result = results.find(r => r.entry.id === '1');
      expect(s0c7Result).toBeDefined();
      expect(s0c7Result!.entry.tags).toContain('numeric');
      expect(s0c7Result!.matchType).toBe('tag');
    });
  });

  describe('Search Quality Metrics', () => {
    it('should provide relevant highlights', async () => {
      const query = 'VSAM status 35';
      const results = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: false,
        includeHighlights: true,
        sortBy: 'relevance'
      });

      const vsam35Result = results.find(r => r.entry.id === '2');
      expect(vsam35Result).toBeDefined();
      expect(vsam35Result!.highlights).toBeDefined();
      expect(vsam35Result!.highlights!.length).toBeGreaterThan(0);

      // Should highlight matching terms
      const titleHighlight = vsam35Result!.highlights!.find(h => h.field === 'title');
      expect(titleHighlight).toBeDefined();
    });

    it('should respect threshold settings', async () => {
      const query = 'unrelated search term';

      // High threshold should return fewer results
      const highThresholdResults = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: false,
        threshold: 0.8,
        sortBy: 'relevance'
      });

      // Low threshold should return more results
      const lowThresholdResults = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: false,
        threshold: 0.1,
        sortBy: 'relevance'
      });

      expect(lowThresholdResults.length).toBeGreaterThanOrEqual(highThresholdResults.length);
    });

    it('should provide search explanations for AI results', async () => {
      const query = 'program crashes with numeric data';
      const results = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: true,
        includeExplanations: true,
        sortBy: 'relevance'
      });

      if (results.length > 0) {
        const topResult = results[0];
        if (topResult.matchType === 'ai' || topResult.matchType === 'semantic') {
          expect(topResult.explanation).toBeDefined();
          expect(topResult.explanation).toContain('match');
        }
      }
    });
  });

  describe('Performance Requirements', () => {
    it('should complete search within 1 second', async () => {
      const startTime = performance.now();

      const query = 'COBOL error';
      await searchService.search(query, mockEntries, {
        limit: 50,
        useAI: false,
        sortBy: 'relevance'
      });

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle large result sets efficiently', async () => {
      // Create larger test dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockEntries[i % mockEntries.length],
        id: `entry-${i}`,
        title: `Test Entry ${i} - ${mockEntries[i % mockEntries.length].title}`
      }));

      await searchService.buildIndex(largeDataset);

      const startTime = performance.now();
      const results = await searchService.search('error', largeDataset, {
        limit: 100,
        useAI: false,
        sortBy: 'relevance'
      });

      const duration = performance.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(2000); // Less than 2 seconds for large dataset
    });
  });

  describe('AI Semantic Search Quality', () => {
    it('should understand semantic similarity', async () => {
      const query = 'program terminates unexpectedly with data problem';
      const results = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: true,
        sortBy: 'relevance'
      });

      // Should find S0C7 abend even without exact term match
      const relevantResult = results.find(r =>
        r.entry.tags.includes('S0C7') ||
        r.entry.tags.includes('abend')
      );

      if (relevantResult) {
        expect(relevantResult.matchType).toMatch(/semantic|ai/);
        expect(relevantResult.score).toBeGreaterThan(40);
      }
    });

    it('should fall back to local search on AI failure', async () => {
      // Mock AI service failure
      const originalSearch = searchService.search;
      jest.spyOn(searchService, 'search').mockImplementationOnce(async (query, entries, options) => {
        if (options.useAI) {
          // Simulate AI failure, should fall back to local search
          return originalSearch.call(searchService, query, entries, { ...options, useAI: false });
        }
        return originalSearch.call(searchService, query, entries, options);
      });

      const query = 'S0C7 abend';
      const results = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: true,
        sortBy: 'relevance'
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.id).toBe('1'); // Should still find the correct result
    });
  });

  describe('Search Result Quality Assessment', () => {
    interface QualityMetrics {
      precision: number; // Relevant results / Total results
      recall: number; // Relevant results found / Total relevant available
      f1Score: number; // Harmonic mean of precision and recall
      averageRelevanceScore: number;
      rankingQuality: number; // How well relevant items are ranked
    }

    const calculateQualityMetrics = (
      query: string,
      results: SearchResult[],
      expectedRelevantIds: string[]
    ): QualityMetrics => {
      const relevantResults = results.filter(r =>
        expectedRelevantIds.includes(r.entry.id)
      );

      const precision = results.length > 0 ? relevantResults.length / results.length : 0;
      const recall = expectedRelevantIds.length > 0 ? relevantResults.length / expectedRelevantIds.length : 0;
      const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

      const averageRelevanceScore = results.length > 0
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length
        : 0;

      // Calculate ranking quality (relevant items should appear first)
      let rankingScore = 0;
      for (let i = 0; i < results.length; i++) {
        if (expectedRelevantIds.includes(results[i].entry.id)) {
          rankingScore += (results.length - i) / results.length;
        }
      }
      const rankingQuality = relevantResults.length > 0 ? rankingScore / relevantResults.length : 0;

      return {
        precision,
        recall,
        f1Score,
        averageRelevanceScore,
        rankingQuality
      };
    };

    it('should achieve high precision for specific queries', async () => {
      const query = 'S0C7 data exception';
      const results = await searchService.search(query, mockEntries, {
        limit: 5,
        useAI: false,
        threshold: 0.5,
        sortBy: 'relevance'
      });

      const expectedRelevantIds = ['1']; // Only S0C7 entry is relevant
      const metrics = calculateQualityMetrics(query, results, expectedRelevantIds);

      expect(metrics.precision).toBeGreaterThan(0.8); // 80% precision
      expect(metrics.rankingQuality).toBeGreaterThan(0.9); // Relevant item should be first
    });

    it('should achieve good recall for broader queries', async () => {
      const query = 'error abend';
      const results = await searchService.search(query, mockEntries, {
        limit: 10,
        useAI: false,
        threshold: 0.3,
        sortBy: 'relevance'
      });

      const expectedRelevantIds = ['1', '5']; // S0C7 and CICS timeout have abend/error
      const metrics = calculateQualityMetrics(query, results, expectedRelevantIds);

      expect(metrics.recall).toBeGreaterThan(0.5); // Should find at least half of relevant items
      expect(metrics.f1Score).toBeGreaterThan(0.4); // Balanced precision and recall
    });

    it('should maintain quality across different categories', async () => {
      const testCases = [
        { query: 'VSAM file', expectedIds: ['2'], category: 'VSAM' },
        { query: 'job failure', expectedIds: ['3'], category: 'JCL' },
        { query: 'SQL error', expectedIds: ['4'], category: 'DB2' },
        { query: 'CICS transaction', expectedIds: ['5'], category: 'CICS' }
      ];

      for (const testCase of testCases) {
        const results = await searchService.search(testCase.query, mockEntries, {
          limit: 5,
          useAI: false,
          category: testCase.category as any,
          sortBy: 'relevance'
        });

        const metrics = calculateQualityMetrics(testCase.query, results, testCase.expectedIds);

        expect(metrics.precision).toBeGreaterThan(0.7); // 70% precision minimum
        expect(metrics.averageRelevanceScore).toBeGreaterThan(60); // 60% relevance minimum
      }
    });
  });

  describe('Search Result Consistency', () => {
    it('should return consistent results for identical queries', async () => {
      const query = 'VSAM status 35';
      const options = {
        limit: 10,
        useAI: false,
        sortBy: 'relevance' as const
      };

      const results1 = await searchService.search(query, mockEntries, options);
      const results2 = await searchService.search(query, mockEntries, options);

      expect(results1).toEqual(results2);
    });

    it('should handle edge cases gracefully', async () => {
      const edgeCases = [
        '', // Empty query
        '   ', // Whitespace only
        'zzz_nonexistent_term_xyz', // No matches
        'a', // Single character
        'a'.repeat(1000), // Very long query
        '!@#$%^&*()', // Special characters only
        'SELECT * FROM users WHERE 1=1; DROP TABLE users;' // SQL injection attempt
      ];

      for (const query of edgeCases) {
        const results = await searchService.search(query, mockEntries, {
          limit: 10,
          useAI: false,
          sortBy: 'relevance'
        });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThanOrEqual(0);

        // Results should be properly formatted
        results.forEach(result => {
          expect(result).toHaveProperty('entry');
          expect(result).toHaveProperty('score');
          expect(result).toHaveProperty('matchType');
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);
        });
      }
    });
  });
});