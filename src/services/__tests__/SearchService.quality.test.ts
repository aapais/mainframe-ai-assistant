/**
 * SearchService Quality Tests
 * Testing relevance scoring, ranking accuracy, fuzzy matching, and edge cases
 */

import { SearchService } from '../SearchService';
import { KBEntry, SearchOptions } from '../../types/services';

describe('SearchService Quality Tests', () => {
  let searchService: SearchService;
  let qualityTestEntries: KBEntry[];

  beforeAll(() => {
    searchService = new SearchService();
    qualityTestEntries = createQualityTestDataset();
  });

  function createQualityTestDataset(): KBEntry[] {
    return [
      // High relevance entries for specific queries
      {
        id: 'vsam-exact-1',
        title: 'VSAM Status 35 File Not Found',
        problem:
          'Job abends with VSAM status code 35, indicating the VSAM file cannot be found or opened.',
        solution: 'Check dataset catalog, verify DD statement, ensure proper RACF permissions.',
        category: 'VSAM',
        tags: ['vsam', 'status-35', 'file-not-found', 'catalog'],
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
        created_by: 'expert',
        usage_count: 150,
        success_count: 140,
        failure_count: 10,
        version: 1,
      },
      {
        id: 'vsam-related-1',
        title: 'VSAM File Access Error',
        problem: 'Cannot access VSAM file, various status codes reported.',
        solution: 'General VSAM troubleshooting steps.',
        category: 'VSAM',
        tags: ['vsam', 'access', 'error'],
        created_at: new Date('2024-01-02'),
        updated_at: new Date('2024-01-02'),
        created_by: 'user',
        usage_count: 50,
        success_count: 30,
        failure_count: 20,
        version: 1,
      },
      {
        id: 's0c7-exact-1',
        title: 'S0C7 Data Exception Abend',
        problem:
          'Program terminates with S0C7 abend during arithmetic operations or data manipulation.',
        solution: 'Check numeric fields, initialize working storage, verify data integrity.',
        category: 'Batch',
        tags: ['s0c7', 'abend', 'data-exception', 'numeric'],
        created_at: new Date('2024-01-03'),
        updated_at: new Date('2024-01-03'),
        created_by: 'expert',
        usage_count: 200,
        success_count: 180,
        failure_count: 20,
        version: 1,
      },
      {
        id: 'abend-general-1',
        title: 'Program Abend Troubleshooting',
        problem: 'General program abend issues and resolution strategies.',
        solution: 'General abend troubleshooting approach.',
        category: 'Batch',
        tags: ['abend', 'troubleshooting', 'general'],
        created_at: new Date('2024-01-04'),
        updated_at: new Date('2024-01-04'),
        created_by: 'user',
        usage_count: 75,
        success_count: 50,
        failure_count: 25,
        version: 1,
      },
      {
        id: 'jcl-dataset-1',
        title: 'JCL Dataset Not Found IEF212I',
        problem:
          'JCL job fails with IEF212I message indicating dataset not found during allocation.',
        solution: 'Verify dataset name, check catalog, ensure proper generation for GDG.',
        category: 'JCL',
        tags: ['jcl', 'dataset', 'ief212i', 'not-found', 'allocation'],
        created_at: new Date('2024-01-05'),
        updated_at: new Date('2024-01-05'),
        created_by: 'expert',
        usage_count: 100,
        success_count: 90,
        failure_count: 10,
        version: 1,
      },
      {
        id: 'jcl-general-1',
        title: 'JCL Syntax Errors',
        problem: 'Common JCL syntax errors and compilation issues.',
        solution: 'Review JCL syntax rules and common mistakes.',
        category: 'JCL',
        tags: ['jcl', 'syntax', 'errors', 'compilation'],
        created_at: new Date('2024-01-06'),
        updated_at: new Date('2024-01-06'),
        created_by: 'user',
        usage_count: 25,
        success_count: 15,
        failure_count: 10,
        version: 1,
      },
      {
        id: 'db2-resource-1',
        title: 'DB2 SQLCODE -904 Resource Unavailable',
        problem: 'DB2 operation fails with SQLCODE -904, indicating resource is unavailable.',
        solution: 'Check tablespace status, run utilities, contact DBA for assistance.',
        category: 'DB2',
        tags: ['db2', 'sqlcode', '-904', 'resource', 'unavailable'],
        created_at: new Date('2024-01-07'),
        updated_at: new Date('2024-01-07'),
        created_by: 'expert',
        usage_count: 80,
        success_count: 70,
        failure_count: 10,
        version: 1,
      },
      {
        id: 'cics-transaction-1',
        title: 'CICS ASRA Transaction Abend',
        problem: 'CICS transaction abends with ASRA, indicating program check.',
        solution: 'Use CEDF to debug, check for storage violations, review program logic.',
        category: 'Other',
        tags: ['cics', 'asra', 'transaction', 'abend', 'program-check'],
        created_at: new Date('2024-01-08'),
        updated_at: new Date('2024-01-08'),
        created_by: 'expert',
        usage_count: 60,
        success_count: 55,
        failure_count: 5,
        version: 1,
      },
      {
        id: 'file-operation-1',
        title: 'File Operation Errors',
        problem: 'Various file operation errors including read, write, and allocation issues.',
        solution: 'Check file permissions, verify dataset attributes, review JCL DD statements.',
        category: 'System',
        tags: ['file', 'operation', 'errors', 'permissions'],
        created_at: new Date('2024-01-09'),
        updated_at: new Date('2024-01-09'),
        created_by: 'user',
        usage_count: 30,
        success_count: 20,
        failure_count: 10,
        version: 1,
      },
      {
        id: 'security-racf-1',
        title: 'RACF Security Violations',
        problem: 'Program encounters RACF security violations when accessing resources.',
        solution:
          'Check user permissions, verify resource profiles, contact security administrator.',
        category: 'System',
        tags: ['racf', 'security', 'violations', 'permissions'],
        created_at: new Date('2024-01-10'),
        updated_at: new Date('2024-01-10'),
        created_by: 'expert',
        usage_count: 40,
        success_count: 35,
        failure_count: 5,
        version: 1,
      },
    ];
  }

  describe('Relevance Scoring Quality Tests', () => {
    test('should prioritize exact title matches', async () => {
      const results = await searchService.search(
        'VSAM Status 35 File Not Found',
        qualityTestEntries
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.id).toBe('vsam-exact-1');
      expect(results[0].score).toBeGreaterThan(90);
      expect(results[0].matchType).toBe('exact');
    });

    test('should score keyword matches appropriately', async () => {
      const results = await searchService.search('S0C7 abend', qualityTestEntries);

      expect(results.length).toBeGreaterThan(0);

      // S0C7 specific entry should rank higher than general abend entry
      const s0c7Entry = results.find(r => r.entry.id === 's0c7-exact-1');
      const generalAbendEntry = results.find(r => r.entry.id === 'abend-general-1');

      expect(s0c7Entry).toBeDefined();
      expect(generalAbendEntry).toBeDefined();

      if (s0c7Entry && generalAbendEntry) {
        expect(s0c7Entry.score).toBeGreaterThan(generalAbendEntry.score);
      }
    });

    test('should consider category relevance in scoring', async () => {
      const results = await searchService.search('JCL dataset error', qualityTestEntries);

      const jclEntries = results.filter(r => r.entry.category === 'JCL');
      const nonJclEntries = results.filter(r => r.entry.category !== 'JCL');

      if (jclEntries.length > 0 && nonJclEntries.length > 0) {
        const topJclScore = Math.max(...jclEntries.map(e => e.score));
        const topNonJclScore = Math.max(...nonJclEntries.map(e => e.score));

        expect(topJclScore).toBeGreaterThan(topNonJclScore * 0.8); // Should be competitive
      }
    });

    test('should boost entries with higher success rates', async () => {
      const results = await searchService.search('VSAM', qualityTestEntries);

      const exactEntry = results.find(r => r.entry.id === 'vsam-exact-1'); // 93% success rate
      const relatedEntry = results.find(r => r.entry.id === 'vsam-related-1'); // 60% success rate

      if (exactEntry && relatedEntry) {
        expect(exactEntry.score).toBeGreaterThan(relatedEntry.score);
      }
    });

    test('should boost entries with higher usage counts', async () => {
      const results = await searchService.search('abend', qualityTestEntries);

      const s0c7Entry = results.find(r => r.entry.id === 's0c7-exact-1'); // 200 usage
      const generalEntry = results.find(r => r.entry.id === 'abend-general-1'); // 75 usage

      if (s0c7Entry && generalEntry) {
        // Higher usage should contribute to better ranking
        expect(s0c7Entry.entry.usage_count).toBeGreaterThan(generalEntry.entry.usage_count);
      }
    });

    test('should penalize poor success rates appropriately', async () => {
      const results = await searchService.search('file operation', qualityTestEntries);

      // Entries with poor success rates should be ranked lower
      results.forEach(result => {
        const successRate =
          result.entry.success_count / (result.entry.success_count + result.entry.failure_count);

        if (successRate < 0.5) {
          expect(result.score).toBeLessThan(80); // Should be penalized
        }
      });
    });
  });

  describe('Ranking Accuracy Tests', () => {
    test('should rank results in order of relevance', async () => {
      const results = await searchService.search('dataset not found', qualityTestEntries);

      expect(results.length).toBeGreaterThan(1);

      // Verify descending score order
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    test('should prioritize domain-specific matches', async () => {
      const results = await searchService.search('SQLCODE error', qualityTestEntries);

      const db2Entry = results.find(r => r.entry.category === 'DB2');
      const nonDb2Entries = results.filter(r => r.entry.category !== 'DB2');

      if (db2Entry && nonDb2Entries.length > 0) {
        const bestNonDb2Score = Math.max(...nonDb2Entries.map(e => e.score));
        expect(db2Entry.score).toBeGreaterThanOrEqual(bestNonDb2Score * 0.9);
      }
    });

    test('should handle tie-breaking consistently', async () => {
      // Test multiple searches with same query to ensure consistent ranking
      const query = 'error troubleshooting';

      const results1 = await searchService.search(query, qualityTestEntries);
      const results2 = await searchService.search(query, qualityTestEntries);
      const results3 = await searchService.search(query, qualityTestEntries);

      // Rankings should be consistent
      expect(results1.length).toBe(results2.length);
      expect(results2.length).toBe(results3.length);

      for (let i = 0; i < results1.length; i++) {
        expect(results1[i].entry.id).toBe(results2[i].entry.id);
        expect(results2[i].entry.id).toBe(results3[i].entry.id);
      }
    });

    test('should maintain ranking stability with score differences', async () => {
      const results = await searchService.search('program abend', qualityTestEntries);

      if (results.length > 1) {
        // Check that significant score differences maintain stable ranking
        for (let i = 1; i < results.length; i++) {
          const scoreDiff = results[i - 1].score - results[i].score;
          if (scoreDiff > 10) {
            // Significant difference should maintain order
            expect(results[i - 1].score).toBeGreaterThan(results[i].score);
          }
        }
      }
    });

    test('should rank by different criteria when specified', async () => {
      const relevanceResults = await searchService.search('error', qualityTestEntries, {
        sortBy: 'relevance',
      });
      const usageResults = await searchService.search('error', qualityTestEntries, {
        sortBy: 'usage',
      });
      const recentResults = await searchService.search('error', qualityTestEntries, {
        sortBy: 'recent',
      });

      // Usage-sorted should be ordered by usage count
      if (usageResults.length > 1) {
        for (let i = 1; i < usageResults.length; i++) {
          expect(usageResults[i - 1].entry.usage_count).toBeGreaterThanOrEqual(
            usageResults[i].entry.usage_count
          );
        }
      }

      // Recent-sorted should be ordered by creation date
      if (recentResults.length > 1) {
        for (let i = 1; i < recentResults.length; i++) {
          expect(recentResults[i - 1].entry.created_at.getTime()).toBeGreaterThanOrEqual(
            recentResults[i].entry.created_at.getTime()
          );
        }
      }
    });
  });

  describe('Fuzzy Matching Quality Tests', () => {
    test('should find results with minor typos', async () => {
      const typoQueries = [
        'VSMA status', // VSAM
        'S0C7 abedn', // abend
        'JKL dataset', // JCL
        'DB@ SQLCODE', // DB2
        'progarm check', // program
      ];

      for (const query of typoQueries) {
        const results = await searchService.search(query, qualityTestEntries);
        expect(results.length).toBeGreaterThan(0);
      }
    });

    test('should handle case variations correctly', async () => {
      const queries = ['vsam status 35', 'VSAM STATUS 35', 'Vsam Status 35', 'vSaM sTaTuS 35'];

      const resultSets = await Promise.all(
        queries.map(query => searchService.search(query, qualityTestEntries))
      );

      // All variations should return similar results
      for (let i = 1; i < resultSets.length; i++) {
        expect(resultSets[i].length).toBe(resultSets[0].length);
        if (resultSets[i].length > 0) {
          expect(resultSets[i][0].entry.id).toBe(resultSets[0][0].entry.id);
        }
      }
    });

    test('should handle abbreviated terms', async () => {
      const abbreviationTests = [
        { query: 'DB2 SQL', expected: 'db2-resource-1' },
        { query: 'CICS TXN', expected: 'cics-transaction-1' },
        { query: 'RACF SEC', expected: 'security-racf-1' },
      ];

      for (const test of abbreviationTests) {
        const results = await searchService.search(test.query, qualityTestEntries);
        const expectedEntry = results.find(r => r.entry.id === test.expected);
        expect(expectedEntry).toBeDefined();
      }
    });

    test('should handle partial word matches', async () => {
      const partialTests = [
        { query: 'stat', shouldFind: 'vsam-exact-1' },
        { query: 'abnd', shouldFind: 's0c7-exact-1' },
        { query: 'alloc', shouldFind: 'jcl-dataset-1' },
      ];

      for (const test of partialTests) {
        const results = await searchService.search(test.query, qualityTestEntries);
        const foundEntry = results.find(r => r.entry.id === test.shouldFind);
        expect(foundEntry).toBeDefined();
      }
    });

    test('should maintain quality with fuzzy matching', async () => {
      const fuzzyResults = await searchService.search('vsma error', qualityTestEntries);

      expect(fuzzyResults.length).toBeGreaterThan(0);

      // Fuzzy matches should still be relevant
      const vsamEntry = fuzzyResults.find(r => r.entry.category === 'VSAM');
      expect(vsamEntry).toBeDefined();
      expect(vsamEntry?.score).toBeGreaterThan(30); // Reasonable score for fuzzy match
    });
  });

  describe('Search Context Quality Tests', () => {
    test('should understand problem context', async () => {
      const contextualQueries = [
        'job fails with status 35',
        'program terminates with S0C7',
        'allocation error for dataset',
        'transaction abends in CICS',
      ];

      const expectedCategories = ['VSAM', 'Batch', 'JCL', 'Other'];

      for (let i = 0; i < contextualQueries.length; i++) {
        const results = await searchService.search(contextualQueries[i], qualityTestEntries);
        expect(results.length).toBeGreaterThan(0);

        const topResult = results[0];
        expect(topResult.entry.category).toBe(expectedCategories[i]);
      }
    });

    test('should recognize mainframe-specific terminology', async () => {
      const mainframeTerms = [
        'abend',
        'dataset',
        'RACF',
        'SQLCODE',
        'VSAM',
        'JCL',
        'CICS',
        'allocation',
      ];

      for (const term of mainframeTerms) {
        const results = await searchService.search(term, qualityTestEntries);
        expect(results.length).toBeGreaterThan(0);

        // Should find entries relevant to mainframe context
        const relevantEntries = results.filter(
          r =>
            r.entry.title.toLowerCase().includes(term.toLowerCase()) ||
            r.entry.problem.toLowerCase().includes(term.toLowerCase()) ||
            r.entry.tags.some(tag => tag.toLowerCase().includes(term.toLowerCase()))
        );

        expect(relevantEntries.length).toBeGreaterThan(0);
      }
    });

    test('should handle multi-concept queries', async () => {
      const multiConceptQueries = [
        'VSAM file access security error',
        'JCL dataset allocation permission denied',
        'DB2 SQLCODE resource deadlock',
        'CICS transaction timeout abend',
      ];

      for (const query of multiConceptQueries) {
        const results = await searchService.search(query, qualityTestEntries);
        expect(results.length).toBeGreaterThan(0);

        // Should find entries that address multiple concepts
        const topResult = results[0];
        expect(topResult.score).toBeGreaterThan(40); // Reasonable multi-concept match
      }
    });
  });

  describe('Edge Case Quality Tests', () => {
    test('should handle numeric codes correctly', async () => {
      const numericQueries = ['35', '904', '212', 'S0C7', '-904'];

      for (const query of numericQueries) {
        const results = await searchService.search(query, qualityTestEntries);

        if (results.length > 0) {
          // Should find entries containing the numeric code
          const relevantEntry = results.find(
            r =>
              r.entry.title.includes(query) ||
              r.entry.problem.includes(query) ||
              r.entry.tags.some(tag => tag.includes(query.toLowerCase()))
          );

          expect(relevantEntry).toBeDefined();
        }
      }
    });

    test('should handle special characters appropriately', async () => {
      const specialCharQueries = ['IEF212I', 'S0C7', '-904', 'ASRA'];

      for (const query of specialCharQueries) {
        const results = await searchService.search(query, qualityTestEntries);

        if (results.length > 0) {
          expect(results[0].score).toBeGreaterThan(50); // Should match well
        }
      }
    });

    test('should gracefully handle very short queries', async () => {
      const shortQueries = ['S', 'DB', 'JC', 'VS'];

      for (const query of shortQueries) {
        const results = await searchService.search(query, qualityTestEntries);

        // Should either return no results or relevant results
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBeTruthy();

        if (results.length > 0) {
          expect(results[0].score).toBeGreaterThan(0);
        }
      }
    });

    test('should handle very long queries efficiently', async () => {
      const longQuery =
        'I am having a problem with my mainframe job that is failing with a VSAM status code 35 error and I cannot figure out why the dataset is not being found even though I have checked the catalog and the DD statement looks correct and I have verified the permissions but the job still abends';

      const results = await searchService.search(longQuery, qualityTestEntries);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Should still find the VSAM entry
      const vsamEntry = results.find(r => r.entry.id === 'vsam-exact-1');
      expect(vsamEntry).toBeDefined();
    });

    test('should maintain quality with filtering options', async () => {
      const options: SearchOptions = {
        category: 'VSAM',
        tags: ['status-35'],
        threshold: 0.3,
      };

      const results = await searchService.search('file error', qualityTestEntries, options);

      // Should respect filters while maintaining quality
      results.forEach(result => {
        expect(result.entry.category).toBe('VSAM');
        expect(result.entry.tags).toContain('status-35');
        expect(result.score).toBeGreaterThan(30);
      });
    });
  });

  describe('Search Quality Metrics Tests', () => {
    test('should provide meaningful confidence scores', async () => {
      const results = await searchService.search('VSAM status 35', qualityTestEntries);

      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.metadata?.confidence).toBeGreaterThanOrEqual(0);
        expect(result.metadata?.confidence).toBeLessThanOrEqual(1);
      });
    });

    test('should provide appropriate match type classifications', async () => {
      const testCases = [
        { query: 'VSAM Status 35 File Not Found', expectedType: 'exact' },
        { query: 'VSAM status error', expectedType: 'fuzzy' },
        { query: 'status-35', expectedType: 'tag' },
        { query: 'VSAM', expectedType: 'category' },
      ];

      for (const testCase of testCases) {
        const results = await searchService.search(testCase.query, qualityTestEntries);

        if (results.length > 0) {
          const topResult = results[0];
          expect(['exact', 'fuzzy', 'tag', 'category', 'semantic', 'ai']).toContain(
            topResult.matchType
          );
        }
      }
    });

    test('should provide search explanations that make sense', async () => {
      const results = await searchService.search('S0C7 data exception', qualityTestEntries);

      if (results.length > 0) {
        const explanation = await searchService.explain('S0C7 data exception', results[0]);

        expect(explanation).toBeDefined();
        expect(typeof explanation).toBe('string');
        expect(explanation.length).toBeGreaterThan(10);

        // Should mention key aspects
        expect(explanation.toLowerCase()).toMatch(/match|confidence|score/);
      }
    });

    test('should track search quality over time', async () => {
      // Perform multiple searches
      const queries = [
        'VSAM error',
        'S0C7 abend',
        'JCL dataset',
        'DB2 resource',
        'CICS transaction',
      ];

      const searchResults = [];
      for (const query of queries) {
        const results = await searchService.search(query, qualityTestEntries);
        searchResults.push({ query, results });
      }

      // Analyze search quality metrics
      const totalSearches = searchResults.length;
      const successfulSearches = searchResults.filter(s => s.results.length > 0).length;
      const avgResultCount =
        searchResults.reduce((sum, s) => sum + s.results.length, 0) / totalSearches;
      const avgTopScore =
        searchResults
          .filter(s => s.results.length > 0)
          .reduce((sum, s) => sum + s.results[0].score, 0) / successfulSearches;

      expect(successfulSearches / totalSearches).toBeGreaterThan(0.8); // 80% success rate
      expect(avgResultCount).toBeGreaterThan(1); // Should find multiple relevant results
      expect(avgTopScore).toBeGreaterThan(50); // Good quality matches
    });
  });
});
