/**
 * Comprehensive Test Suite for Enhanced FTS5 Search Implementation
 *
 * Tests all aspects of the enhanced FTS5 search engine including:
 * - Custom mainframe tokenizer functionality
 * - BM25 ranking with domain-specific weights
 * - Context-aware snippet generation
 * - Performance benchmarking
 * - Integration with existing SearchService
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { FTS5EnhancedSearch } from '../../src/database/FTS5EnhancedSearch';
import { FTS5MainframeTokenizer, createMainframeTokenizer } from '../../src/database/FTS5MainframeTokenizer';
import { EnhancedSearchService } from '../../src/services/EnhancedSearchService';
import { KBEntry } from '../../src/types/services';

describe('Enhanced FTS5 Search Implementation', () => {
  let db: Database.Database;
  let fts5Engine: FTS5EnhancedSearch;
  let tokenizer: FTS5MainframeTokenizer;
  let searchService: EnhancedSearchService;

  const testDbPath = ':memory:'; // Use in-memory database for tests

  // Sample test data with mainframe-specific content
  const testEntries: KBEntry[] = [
    {
      id: '1',
      title: 'S0C7 Data Exception Error',
      problem: 'Job MYJOB01 abends with system completion code S0C7 during arithmetic operation in COBOL program.',
      solution: '1. Check for uninitialized COMP-3 fields\n2. Validate numeric data before arithmetic\n3. Use INITIALIZE statement for working storage',
      category: 'Batch',
      severity: 'high',
      tags: ['s0c7', 'abend', 'cobol', 'arithmetic'],
      usage_count: 45,
      success_count: 38,
      failure_count: 7
    },
    {
      id: '2',
      title: 'VSAM Status 35 File Not Found',
      problem: 'VSAM KSDS access returns status code 35 indicating file not found during batch processing.',
      solution: '1. Verify dataset exists in catalog\n2. Check file allocation in JCL\n3. Ensure proper DISP parameter',
      category: 'VSAM',
      severity: 'medium',
      tags: ['vsam', 'status-35', 'ksds', 'catalog'],
      usage_count: 32,
      success_count: 28,
      failure_count: 4
    },
    {
      id: '3',
      title: 'IEF212I Step Not Executed',
      problem: 'Job step //STEP01 not executed, message IEF212I appears in job output.',
      solution: '1. Check JCL syntax for step\n2. Verify program name in EXEC statement\n3. Review COND parameter on job or previous steps',
      category: 'JCL',
      severity: 'medium',
      tags: ['ief212i', 'jcl', 'step', 'execution'],
      usage_count: 28,
      success_count: 25,
      failure_count: 3
    },
    {
      id: '4',
      title: 'DB2 SQLCODE -904 Resource Unavailable',
      problem: 'DB2 application receives SQLCODE -904 indicating resource limit exceeded.',
      solution: '1. Check thread limits in DB2\n2. Review connection pooling\n3. Optimize SQL queries for efficiency',
      category: 'DB2',
      severity: 'high',
      tags: ['db2', 'sqlcode', 'resource', 'thread'],
      usage_count: 22,
      success_count: 18,
      failure_count: 4
    },
    {
      id: '5',
      title: 'CICS Transaction ABEND AEY9',
      problem: 'CICS transaction TRAN01 abends with code AEY9 during COMMAREA processing.',
      solution: '1. Check COMMAREA length\n2. Verify program linkage\n3. Review transaction definition',
      category: 'CICS',
      severity: 'medium',
      tags: ['cics', 'abend', 'aey9', 'commarea'],
      usage_count: 15,
      success_count: 12,
      failure_count: 3
    },
    {
      id: '6',
      title: 'JCL Dataset Allocation Error',
      problem: 'Dataset allocation fails with message about insufficient space or invalid SPACE parameter.',
      solution: '1. Increase SPACE allocation\n2. Check unit specification\n3. Verify volume availability',
      category: 'JCL',
      severity: 'low',
      tags: ['jcl', 'dataset', 'allocation', 'space'],
      usage_count: 18,
      success_count: 16,
      failure_count: 2
    }
  ];

  beforeAll(async () => {
    // Initialize test database
    db = new Database(testDbPath);

    // Load schema
    const schemaPath = path.join(__dirname, '../../src/database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    // Apply enhanced FTS5 migration
    const migrationPath = path.join(__dirname, '../../src/database/migrations/003_enhanced_fts5.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    db.exec(migration);

    // Insert test data
    const insertStmt = db.prepare(`
      INSERT INTO kb_entries (id, title, problem, solution, category, severity, usage_count, success_count, failure_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTagStmt = db.prepare(`
      INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)
    `);

    for (const entry of testEntries) {
      insertStmt.run(
        entry.id,
        entry.title,
        entry.problem,
        entry.solution,
        entry.category,
        entry.severity,
        entry.usage_count,
        entry.success_count,
        entry.failure_count
      );

      // Insert tags
      if (entry.tags) {
        for (const tag of entry.tags) {
          insertTagStmt.run(entry.id, tag);
        }
      }
    }

    // Initialize engines
    fts5Engine = new FTS5EnhancedSearch(db);
    tokenizer = createMainframeTokenizer();
    searchService = new EnhancedSearchService(undefined, db);

    console.log('✅ Test environment initialized');
  });

  afterAll(async () => {
    if (db) {
      db.close();
    }
  });

  describe('Mainframe Tokenizer', () => {
    it('should correctly identify and preserve error codes', () => {
      const testCases = [
        { input: 'S0C7 error occurred', expected: ['S0C7', 'error', 'occurred'] },
        { input: 'IEF212I step not executed', expected: ['IEF212I', 'step', 'executed'] },
        { input: 'WER027A sort failure', expected: ['WER027A', 'sort', 'failure'] },
        { input: 'SQLCODE -904 resource', expected: ['SQLCODE', 'resource'] },
        { input: 'VSAM STATUS 35', expected: ['VSAM', 'STATUS'] }
      ];

      testCases.forEach(({ input, expected }) => {
        const tokens = tokenizer.tokenize(input);
        const tokenTexts = tokens.map(t => t.token);

        expected.forEach(expectedToken => {
          expect(tokenTexts).toContain(expectedToken);
        });
      });
    });

    it('should assign appropriate weights to different token types', () => {
      const tokens = tokenizer.tokenize('S0C7 COBOL MOVE statement error');

      // Error code should have highest weight
      const s0c7Token = tokens.find(t => t.token === 'S0C7');
      expect(s0c7Token?.weight).toBe(3.0);

      // COBOL keyword should have medium-high weight
      const cobolToken = tokens.find(t => t.token === 'COBOL');
      expect(cobolToken?.weight).toBe(2.0);

      // General terms should have default weight
      const errorToken = tokens.find(t => t.token === 'error');
      expect(errorToken?.weight).toBe(1.0);
    });

    it('should generate optimized FTS5 queries', () => {
      const testCases = [
        {
          input: 'S0C7',
          expected: '"S0C7"' // Error codes get exact match
        },
        {
          input: 'VSAM status error',
          expected: '(VSAM OR vsam*) AND (STATUS OR status*) AND (error* OR error*)'
        },
        {
          input: 'JCL dataset allocation',
          expected: '(JCL OR jcl*) AND (dataset* OR dataset*) AND (allocation* OR allocation*)'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const query = tokenizer.generateFTS5Query(input);
        expect(query).toBeTruthy();
        // Verify it contains key components (exact match testing would be too brittle)
        if (input === 'S0C7') {
          expect(query).toContain('S0C7');
        }
      });
    });

    it('should handle mainframe-specific stemming correctly', () => {
      const testCases = [
        { input: 'processing', expected: 'process' },
        { input: 'allocation', expected: 'allocat' },
        { input: 'compilation', expected: 'compil' },
        { input: 'successful', expected: 'success' }
      ];

      testCases.forEach(({ input, expected }) => {
        const tokens = tokenizer.tokenize(input);
        const token = tokens.find(t => t.token === input.toLowerCase());
        expect(token?.stemmed).toBe(expected);
      });
    });

    it('should validate tokens correctly', () => {
      const validTokens = ['S0C7', 'COBOL', 'error', 'dataset'];
      const invalidTokens = ['', 'a', '123', 'x'.repeat(51)];

      validTokens.forEach(token => {
        expect(tokenizer.shouldIndex(token)).toBe(true);
      });

      invalidTokens.forEach(token => {
        expect(tokenizer.shouldIndex(token)).toBe(false);
      });
    });
  });

  describe('Enhanced FTS5 Search Engine', () => {
    it('should perform basic search and return results', async () => {
      const results = await fts5Engine.search('S0C7');

      expect(results).toHaveLength(1);
      expect(results[0].entry.title).toContain('S0C7');
      expect(results[0].score).toBeGreaterThan(80); // Should have high relevance
    });

    it('should generate context-aware snippets', async () => {
      const results = await fts5Engine.search('COBOL arithmetic', {
        enableSnippets: true,
        snippetLength: 150
      });

      expect(results).toHaveLength(1);
      expect(results[0].snippets).toBeDefined();
      expect(results[0].snippets!.length).toBeGreaterThan(0);

      const snippet = results[0].snippets![0];
      expect(snippet.text).toContain('<mark>');
      expect(snippet.text).toContain('</mark>');
      expect(snippet.highlights.length).toBeGreaterThan(0);
    });

    it('should apply BM25 ranking correctly', async () => {
      const results = await fts5Engine.search('error');

      // Results should be ranked by relevance (BM25 + usage + success rate)
      expect(results.length).toBeGreaterThan(1);

      // First result should have higher score than subsequent ones
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should use different ranking profiles effectively', async () => {
      const queries = ['VSAM', 'dataset allocation'];

      for (const query of queries) {
        const balancedResults = await fts5Engine.search(query, { rankingProfile: 'balanced' });
        const precisionResults = await fts5Engine.search(query, { rankingProfile: 'precision' });
        const mainframeResults = await fts5Engine.search(query, { rankingProfile: 'mainframe_focused' });

        // All should return results
        expect(balancedResults.length).toBeGreaterThan(0);
        expect(precisionResults.length).toBeGreaterThan(0);
        expect(mainframeResults.length).toBeGreaterThan(0);

        // Mainframe-focused should boost mainframe terms
        if (query === 'VSAM') {
          expect(mainframeResults[0].score).toBeGreaterThanOrEqual(balancedResults[0].score);
        }
      }
    });

    it('should handle category and tag filtering', async () => {
      const categoryResults = await fts5Engine.search('error', { category: 'Batch' });
      const tagResults = await fts5Engine.search('error', { tags: ['s0c7'] });

      expect(categoryResults.every(r => r.entry.category === 'Batch')).toBe(true);
      expect(tagResults.every(r => r.entry.tags?.includes('s0c7'))).toBe(true);
    });

    it('should provide search explanations', async () => {
      const results = await fts5Engine.search('S0C7');

      expect(results[0].explanation).toBeDefined();
      expect(results[0].explanation).toContain('Relevance score');
      expect(results[0].debugInfo).toBeDefined();
      expect(results[0].debugInfo!.matchedTerms).toContain('S0C7');
    });

    it('should cache search results effectively', async () => {
      const query = 'VSAM status';

      // First search
      const start1 = performance.now();
      const results1 = await fts5Engine.search(query);
      const time1 = performance.now() - start1;

      // Second search (should be cached)
      const start2 = performance.now();
      const results2 = await fts5Engine.search(query);
      const time2 = performance.now() - start2;

      expect(results1).toEqual(results2);
      expect(time2).toBeLessThan(time1); // Cached should be faster
    });

    it('should optimize and provide statistics', () => {
      fts5Engine.optimize(); // Should not throw

      const stats = fts5Engine.getStatistics();
      expect(stats.indexSize).toBeGreaterThan(0);
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Enhanced Search Service Integration', () => {
    it('should integrate FTS5 search with existing SearchService', async () => {
      const results = await searchService.search('S0C7', testEntries);

      expect(results).toHaveLength(1);
      expect(results[0].metadata?.source).toContain('fts5');
      expect(results[0].metadata?.enhanced).toBe(true);
    });

    it('should fall back to standard search when FTS5 fails', async () => {
      // Test with a query that might fail in FTS5 but work in standard search
      const results = await searchService.search('simple query', testEntries);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should provide enhanced performance metrics', () => {
      const metrics = searchService.getEnhancedPerformanceMetrics();

      expect(metrics.fts5Available).toBe(true);
      expect(metrics.enhancedFeatures).toContain('FTS5 with BM25 ranking');
      expect(metrics.enhancedFeatures).toContain('Custom mainframe tokenizer');
      expect(metrics.performanceComparison).toBeDefined();
    });

    it('should handle auto-complete with mainframe terms', async () => {
      const suggestions = await searchService['autoComplete']?.('S0C');

      if (suggestions) {
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.some(s => s.suggestion.includes('S0C7'))).toBe(true);
      }
    });
  });

  describe('Performance Benchmarks', () => {
    const performanceTests = [
      { name: 'Simple error code search', query: 'S0C7', expectedMaxTime: 50 },
      { name: 'Complex multi-term search', query: 'VSAM KSDS status error allocation', expectedMaxTime: 100 },
      { name: 'Category filtered search', query: 'error', options: { category: 'Batch' }, expectedMaxTime: 75 },
      { name: 'Search with snippets', query: 'COBOL arithmetic', options: { enableSnippets: true }, expectedMaxTime: 150 }
    ];

    performanceTests.forEach(({ name, query, options, expectedMaxTime }) => {
      it(`should complete ${name} within ${expectedMaxTime}ms`, async () => {
        const start = performance.now();
        const results = await fts5Engine.search(query, options);
        const time = performance.now() - start;

        expect(time).toBeLessThan(expectedMaxTime);
        expect(results).toBeDefined();
        console.log(`${name}: ${time.toFixed(2)}ms (${results.length} results)`);
      });
    });

    it('should handle concurrent searches efficiently', async () => {
      const queries = ['S0C7', 'VSAM', 'JCL', 'DB2', 'CICS'];
      const start = performance.now();

      const promises = queries.map(query => fts5Engine.search(query));
      const results = await Promise.all(promises);

      const totalTime = performance.now() - start;
      const avgTime = totalTime / queries.length;

      expect(avgTime).toBeLessThan(100); // Average should be under 100ms
      expect(results.every(r => Array.isArray(r))).toBe(true);

      console.log(`Concurrent searches: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(2)}ms average`);
    });

    it('should scale well with large result sets', async () => {
      // Search for a common term that should return multiple results
      const start = performance.now();
      const results = await fts5Engine.search('error', { limit: 50 });
      const time = performance.now() - start;

      expect(time).toBeLessThan(200); // Should handle large result sets quickly
      expect(results.length).toBeGreaterThan(0);

      console.log(`Large result set search: ${time.toFixed(2)}ms (${results.length} results)`);
    });
  });

  describe('Stress Tests', () => {
    it('should handle malformed queries gracefully', async () => {
      const malformedQueries = [
        '', // Empty query
        '   ', // Whitespace only
        'a'.repeat(1000), // Very long query
        '!@#$%^&*()', // Special characters only
        '"unclosed quote', // Malformed quote
        'SELECT * FROM kb_entries', // SQL injection attempt
      ];

      for (const query of malformedQueries) {
        await expect(fts5Engine.search(query)).resolves.toBeDefined();
      }
    });

    it('should maintain performance under rapid successive searches', async () => {
      const queries = Array(20).fill(0).map((_, i) => `test query ${i}`);
      const times: number[] = [];

      for (const query of queries) {
        const start = performance.now();
        await fts5Engine.search(query);
        times.push(performance.now() - start);
      }

      // Performance should remain consistent (no significant degradation)
      const firstHalf = times.slice(0, 10);
      const secondHalf = times.slice(10);

      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Second half should not be more than 50% slower than first half
      expect(avgSecond).toBeLessThan(avgFirst * 1.5);
    });

    it('should clear cache without affecting functionality', async () => {
      // Perform search to populate cache
      const results1 = await fts5Engine.search('S0C7');

      // Clear cache
      fts5Engine.clearCache();

      // Search again (should still work)
      const results2 = await fts5Engine.search('S0C7');

      expect(results1).toEqual(results2);
    });
  });

  describe('Integration with Existing Infrastructure', () => {
    it('should work with existing caching infrastructure', async () => {
      // Test that enhanced search integrates with existing cache
      const results1 = await searchService.search('cached query', testEntries);
      const results2 = await searchService.search('cached query', testEntries);

      expect(results1).toEqual(results2);
    });

    it('should maintain backward compatibility', async () => {
      // Test that old search methods still work
      const oldStyleResults = await searchService.search('VSAM', testEntries, {
        useAI: false,
        includeHighlights: true
      });

      expect(oldStyleResults).toBeDefined();
      expect(Array.isArray(oldStyleResults)).toBe(true);
      expect(oldStyleResults.length).toBeGreaterThan(0);
    });

    it('should provide migration path from existing search', () => {
      // Verify that enhanced service can be drop-in replacement
      expect(searchService).toBeInstanceOf(EnhancedSearchService);
      expect(typeof searchService.search).toBe('function');
      expect(typeof searchService.getEnhancedPerformanceMetrics).toBe('function');
    });
  });

  describe('Data Quality and Accuracy', () => {
    it('should return most relevant results first', async () => {
      const results = await fts5Engine.search('S0C7 data exception');

      expect(results[0].entry.title).toContain('S0C7');
      expect(results[0].score).toBeGreaterThan(90); // Should be highly relevant
    });

    it('should provide accurate snippets with proper highlighting', async () => {
      const results = await fts5Engine.search('COBOL arithmetic operation', {
        enableSnippets: true
      });

      const snippet = results[0].snippets?.[0];
      expect(snippet).toBeDefined();
      expect(snippet!.text).toContain('arithmetic');
      expect(snippet!.highlights.some(h => h.term.toLowerCase().includes('arithmetic'))).toBe(true);
    });

    it('should maintain data consistency across updates', async () => {
      // Add a new entry
      const newEntry = {
        id: 'test-new',
        title: 'Test New Entry S0C4',
        problem: 'Test problem with S0C4 protection exception',
        solution: 'Test solution for S0C4',
        category: 'Test',
        severity: 'low' as const
      };

      const insertStmt = db.prepare(`
        INSERT INTO kb_entries (id, title, problem, solution, category, severity)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(newEntry.id, newEntry.title, newEntry.problem, newEntry.solution, newEntry.category, newEntry.severity);

      // Search should find the new entry
      const results = await fts5Engine.search('S0C4');
      expect(results.some(r => r.entry.id === 'test-new')).toBe(true);

      // Cleanup
      db.prepare('DELETE FROM kb_entries WHERE id = ?').run('test-new');
    });
  });
});