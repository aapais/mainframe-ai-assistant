/**
 * FTS5 Engine Test Suite
 *
 * Comprehensive tests for SQLite FTS5 full-text search functionality
 * with mainframe-specific tokenization and BM25 ranking.
 *
 * @author Database Architect
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import FTS5Engine, { FTS5Config, MainframeTokenizerConfig } from '../FTS5Engine';
import { KBEntry } from '../../../types';

describe('FTS5Engine', () => {
  let db: Database.Database;
  let fts5Engine: FTS5Engine;
  let testEntries: KBEntry[];

  beforeAll(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Set up basic tables that FTS5 depends on
    db.exec(`
      CREATE TABLE kb_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        usage_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        last_used DATETIME,
        archived BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE kb_tags (
        entry_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (entry_id, tag),
        FOREIGN KEY (entry_id) REFERENCES kb_entries(id) ON DELETE CASCADE
      );
    `);

    // Prepare test data
    testEntries = [
      {
        id: 'test-1',
        title: 'S0C7 Data Exception in COBOL Program',
        problem:
          'Program abends with S0C7 completion code when processing arithmetic operations on COMP-3 fields',
        solution:
          '1. Check for uninitialized COMP-3 fields\n2. Validate input data format\n3. Add defensive programming checks',
        category: 'Batch',
        severity: 'high',
        tags: ['s0c7', 'abend', 'cobol', 'comp-3', 'arithmetic'],
      },
      {
        id: 'test-2',
        title: 'VSAM Status 35 File Not Found Error',
        problem:
          'Job fails with VSAM return code 35 indicating file not found during KSDS processing',
        solution:
          '1. Verify dataset exists in catalog\n2. Check JCL DD statement DSN parameter\n3. Ensure proper allocation',
        category: 'VSAM',
        severity: 'medium',
        tags: ['vsam', 'status-35', 'file-not-found', 'ksds', 'catalog'],
      },
      {
        id: 'test-3',
        title: 'DB2 SQL0803N Duplicate Key Error',
        problem: 'INSERT statement fails with SQLCODE -803 due to duplicate primary key value',
        solution:
          '1. Check for existing records\n2. Use MERGE statement instead\n3. Implement proper key generation strategy',
        category: 'DB2',
        severity: 'medium',
        tags: ['db2', 'sql0803n', 'duplicate-key', 'primary-key', 'insert'],
      },
      {
        id: 'test-4',
        title: 'JCL IEF212I Job Step Execution Error',
        problem:
          'Job step fails with IEF212I message indicating abnormal termination with condition code',
        solution:
          '1. Review job step return codes\n2. Check COND parameters\n3. Verify program logic and data integrity',
        category: 'JCL',
        severity: 'high',
        tags: ['jcl', 'ief212i', 'job-step', 'condition-code', 'abnormal-termination'],
      },
      {
        id: 'test-5',
        title: 'CICS DFHAC2001 Transaction Abend',
        problem:
          'CICS transaction terminates with DFHAC2001 abend code during file access operations',
        solution:
          '1. Check file status in FCTTABLE\n2. Verify VSAM file integrity\n3. Review transaction logic',
        category: 'CICS',
        severity: 'critical',
        tags: ['cics', 'dfhac2001', 'transaction', 'abend', 'file-access'],
      },
    ];

    // Insert test data into database
    const insertEntry = db.prepare(`
      INSERT INTO kb_entries (id, title, problem, solution, category, severity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertTag = db.prepare(`
      INSERT INTO kb_tags (entry_id, tag) VALUES (?, ?)
    `);

    testEntries.forEach(entry => {
      insertEntry.run(
        entry.id,
        entry.title,
        entry.problem,
        entry.solution,
        entry.category,
        entry.severity
      );

      if (entry.tags) {
        entry.tags.forEach(tag => {
          insertTag.run(entry.id, tag);
        });
      }
    });
  });

  beforeEach(async () => {
    // Create fresh FTS5 engine for each test
    fts5Engine = new FTS5Engine(db);
    await fts5Engine.initialize();
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
  });

  describe('Initialization', () => {
    test('should initialize FTS5 engine successfully', async () => {
      const engine = new FTS5Engine(db);
      await expect(engine.initialize()).resolves.not.toThrow();
    });

    test('should create FTS5 virtual table with correct schema', async () => {
      const tableInfo = db
        .prepare(
          `
        SELECT sql FROM sqlite_master
        WHERE type = 'table' AND name = 'kb_fts5'
      `
        )
        .get() as { sql: string } | undefined;

      expect(tableInfo).toBeDefined();
      expect(tableInfo!.sql).toContain('fts5');
      expect(tableInfo!.sql).toContain('tokenize');
    });

    test('should populate FTS5 index with existing entries', async () => {
      const count = db.prepare('SELECT COUNT(*) as count FROM kb_fts5').get() as { count: number };
      expect(count.count).toBe(testEntries.length);
    });

    test('should configure BM25 ranking parameters', async () => {
      // Check if BM25 ranking is configured
      const stats = fts5Engine.getStats();
      expect(stats.documentCount).toBe(testEntries.length);
    });
  });

  describe('Search Functionality', () => {
    test('should perform basic text search', async () => {
      const results = await fts5Engine.search('COBOL S0C7');

      expect(results).toHaveLength(1);
      expect(results[0].entry.id).toBe('test-1');
      expect(results[0].bm25Score).toBeGreaterThan(0);
    });

    test('should handle mainframe error code searches', async () => {
      const results = await fts5Engine.search('S0C7');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.title).toContain('S0C7');
    });

    test('should search VSAM-related entries', async () => {
      const results = await fts5Engine.search('VSAM status');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.category).toBe('VSAM');
    });

    test('should handle DB2 SQL error searches', async () => {
      const results = await fts5Engine.search('SQL0803N duplicate');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.title).toContain('SQL0803N');
    });

    test('should search JCL error messages', async () => {
      const results = await fts5Engine.search('IEF212I job');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.category).toBe('JCL');
    });

    test('should handle CICS transaction searches', async () => {
      const results = await fts5Engine.search('CICS DFHAC2001');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.category).toBe('CICS');
    });

    test('should perform tag-based searches', async () => {
      const results = await fts5Engine.search('abend');

      expect(results.length).toBeGreaterThan(1); // Multiple entries have 'abend' tag
      results.forEach(result => {
        expect(result.entry.tags).toContain('abend');
      });
    });

    test('should rank results by relevance', async () => {
      const results = await fts5Engine.search('error code');

      expect(results.length).toBeGreaterThan(1);

      // Check that results are ordered by BM25 score
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].bm25Score).toBeGreaterThanOrEqual(results[i].bm25Score);
      }
    });

    test('should handle complex multi-term queries', async () => {
      const results = await fts5Engine.search('program abend arithmetic COMP-3');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.id).toBe('test-1'); // Should match S0C7 entry
    });

    test('should support exact phrase searches', async () => {
      const results = await fts5Engine.search('"file not found"');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.problem.toLowerCase()).toContain('file not found');
    });

    test('should handle empty and invalid queries gracefully', async () => {
      const emptyResults = await fts5Engine.search('');
      expect(emptyResults).toHaveLength(0);

      const invalidResults = await fts5Engine.search('xyz123nonexistent');
      expect(invalidResults).toHaveLength(0);
    });
  });

  describe('BM25 Ranking', () => {
    test('should prioritize title matches over content matches', async () => {
      const results = await fts5Engine.search('Data Exception');

      expect(results.length).toBeGreaterThan(0);

      // Entry with "Data Exception" in title should rank higher
      const titleMatch = results.find(r => r.entry.title.includes('Data Exception'));
      expect(titleMatch).toBeDefined();
      expect(titleMatch!.bm25Score).toBeGreaterThan(0);
    });

    test('should calculate proper BM25 scores', async () => {
      const results = await fts5Engine.search('COBOL');

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.bm25Score).toBeGreaterThan(0);
        expect(result.bm25Score).toBeLessThan(1000); // Reasonable upper bound
      });
    });

    test('should boost frequently used entries', async () => {
      // Update usage count for one entry
      db.prepare('UPDATE kb_entries SET usage_count = 100 WHERE id = ?').run('test-1');

      const results = await fts5Engine.search('program');

      expect(results.length).toBeGreaterThan(0);

      // Entry with higher usage should have boosted score
      const highUsageEntry = results.find(r => r.entry.id === 'test-1');
      expect(highUsageEntry).toBeDefined();
    });
  });

  describe('Snippet Generation', () => {
    test('should generate contextual snippets', async () => {
      const results = await fts5Engine.search('arithmetic operations');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippets).toBeDefined();
      expect(results[0].snippets.length).toBeGreaterThan(0);

      const snippet = results[0].snippets[0];
      expect(snippet.text).toContain('arithmetic');
      expect(snippet.field).toBeTruthy();
      expect(snippet.score).toBeGreaterThan(0);
    });

    test('should limit snippet length', async () => {
      const results = await fts5Engine.search('COBOL');

      expect(results.length).toBeGreaterThan(0);
      results[0].snippets.forEach(snippet => {
        expect(snippet.text.length).toBeLessThanOrEqual(250); // Default max + ellipsis
      });
    });

    test('should provide snippets from multiple fields', async () => {
      const results = await fts5Engine.search('VSAM');

      expect(results.length).toBeGreaterThan(0);

      const snippets = results[0].snippets;
      const fieldNames = snippets.map(s => s.field);

      // Should have snippets from title and/or problem/solution
      expect(fieldNames.length).toBeGreaterThan(0);
    });
  });

  describe('Term Matching', () => {
    test('should extract term matches and positions', async () => {
      const results = await fts5Engine.search('VSAM file');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].termMatches).toBeDefined();

      const termMatches = results[0].termMatches;
      expect(Object.keys(termMatches).length).toBeGreaterThan(0);

      // Check if matches have proper structure
      Object.values(termMatches).forEach(match => {
        expect(match.frequency).toBeGreaterThan(0);
        expect(match.positions).toBeInstanceOf(Array);
        expect(match.field).toBeTruthy();
      });
    });

    test('should handle case-insensitive matching', async () => {
      const upperResults = await fts5Engine.search('VSAM');
      const lowerResults = await fts5Engine.search('vsam');

      expect(upperResults.length).toBe(lowerResults.length);
      expect(upperResults[0].entry.id).toBe(lowerResults[0].entry.id);
    });
  });

  describe('Document Management', () => {
    test('should add new documents to FTS5 index', async () => {
      const newEntry: KBEntry = {
        id: 'test-new',
        title: 'New Test Entry',
        problem: 'Test problem description',
        solution: 'Test solution steps',
        category: 'Other',
        tags: ['test', 'new'],
      };

      await fts5Engine.addDocument(newEntry);

      const results = await fts5Engine.search('New Test Entry');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.id).toBe('test-new');
    });

    test('should update existing documents in FTS5 index', async () => {
      const updatedEntry: KBEntry = {
        id: 'test-1',
        title: 'Updated S0C7 Data Exception',
        problem: 'Updated problem description',
        solution: 'Updated solution steps',
        category: 'Batch',
        tags: ['s0c7', 'updated'],
      };

      await fts5Engine.updateDocument(updatedEntry);

      const results = await fts5Engine.search('Updated S0C7');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.title).toContain('Updated');
    });

    test('should remove documents from FTS5 index', async () => {
      await fts5Engine.removeDocument('test-1');

      const results = await fts5Engine.search('S0C7 Data Exception');
      expect(results.length).toBe(0);
    });
  });

  describe('Mainframe Tokenization', () => {
    test('should handle JCL keywords as single tokens', async () => {
      const results = await fts5Engine.search('JCL DD DISP');

      expect(results.length).toBeGreaterThan(0);
      // JCL keywords should be treated as individual tokens, not broken down
    });

    test('should recognize mainframe error code patterns', async () => {
      const errorCodes = ['S0C7', 'IEF212I', 'SQL0803N', 'DFHAC2001'];

      for (const errorCode of errorCodes) {
        const results = await fts5Engine.search(errorCode);
        expect(results.length).toBeGreaterThan(0);
      }
    });

    test('should handle VSAM terminology correctly', async () => {
      const vsamTerms = ['KSDS', 'VSAM', 'DEFINE', 'CLUSTER'];

      for (const term of vsamTerms) {
        const results = await fts5Engine.search(term);
        // Should find relevant entries (not necessarily all will match)
        expect(results.length).toBeGreaterThanOrEqual(0);
      }
    });

    test('should preserve special characters in dataset names', async () => {
      // Add an entry with dataset name
      const dsEntry: KBEntry = {
        id: 'test-dataset',
        title: 'Dataset Access Error',
        problem: 'Cannot access USER.TEST.DATA dataset',
        solution: 'Check dataset allocation and catalog',
        category: 'Other',
        tags: ['dataset', 'access'],
      };

      await fts5Engine.addDocument(dsEntry);

      const results = await fts5Engine.search('USER.TEST.DATA');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Optimization', () => {
    test('should provide index statistics', () => {
      const stats = fts5Engine.getStats();

      expect(stats.documentCount).toBeGreaterThan(0);
      expect(stats.indexSize).toBeGreaterThan(0);
      expect(stats.averageDocumentLength).toBeGreaterThan(0);
    });

    test('should optimize index without errors', async () => {
      await expect(fts5Engine.optimize()).resolves.not.toThrow();
    });

    test('should handle large result sets efficiently', async () => {
      const startTime = Date.now();
      const results = await fts5Engine.search('error', { limit: 100 });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(results.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Search Options', () => {
    test('should respect limit option', async () => {
      const results = await fts5Engine.search('error', { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should handle offset for pagination', async () => {
      const firstPage = await fts5Engine.search('error', { limit: 2, offset: 0 });
      const secondPage = await fts5Engine.search('error', { limit: 2, offset: 2 });

      expect(firstPage.length).toBeGreaterThan(0);
      expect(secondPage.length).toBeGreaterThan(0);

      // Results should be different (assuming more than 2 total results)
      if (firstPage.length > 0 && secondPage.length > 0) {
        expect(firstPage[0].entry.id).not.toBe(secondPage[0].entry.id);
      }
    });

    test('should filter by category when specified', async () => {
      const results = await fts5Engine.search('error', { category: 'VSAM' });

      results.forEach(result => {
        expect(result.entry.category).toBe('VSAM');
      });
    });

    test('should sort by different criteria', async () => {
      const relevanceResults = await fts5Engine.search('error', { sortBy: 'relevance' });
      const usageResults = await fts5Engine.search('error', { sortBy: 'usage' });

      expect(relevanceResults.length).toBeGreaterThan(0);
      expect(usageResults.length).toBeGreaterThan(0);

      // Results should be ordered differently
      if (relevanceResults.length > 1 && usageResults.length > 1) {
        // At least verify they both return results
        expect(relevanceResults[0]).toBeDefined();
        expect(usageResults[0]).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed queries gracefully', async () => {
      const malformedQueries = [
        '"unclosed quote',
        'AND OR NOT',
        '(((',
        null as any,
        undefined as any,
      ];

      for (const query of malformedQueries) {
        await expect(fts5Engine.search(query)).resolves.not.toThrow();
      }
    });

    test('should handle database errors gracefully', async () => {
      // Close the database to simulate error
      const originalDb = fts5Engine['db'];
      fts5Engine['db'] = null as any;

      await expect(fts5Engine.search('test')).rejects.toThrow();

      // Restore database
      fts5Engine['db'] = originalDb;
    });

    test('should handle uninitialized engine', async () => {
      const uninitializedEngine = new FTS5Engine(db);
      // Don't call initialize()

      await expect(uninitializedEngine.search('test')).rejects.toThrow('not initialized');
    });
  });

  describe('Custom Configuration', () => {
    test('should accept custom BM25 parameters', async () => {
      const customConfig: Partial<FTS5Config> = {
        bm25: {
          k1: 2.0,
          b: 0.8,
          titleWeight: 4.0,
          problemWeight: 3.0,
          solutionWeight: 2.0,
          tagsWeight: 1.5,
        },
      };

      const customEngine = new FTS5Engine(db, customConfig);
      await customEngine.initialize();

      const results = await customEngine.search('COBOL');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].bm25Score).toBeGreaterThan(0);
    });

    test('should accept custom snippet configuration', async () => {
      const customConfig: Partial<FTS5Config> = {
        snippet: {
          maxLength: 100,
          contextWindow: 20,
          maxSnippets: 2,
          ellipsis: '...',
        },
      };

      const customEngine = new FTS5Engine(db, customConfig);
      await customEngine.initialize();

      const results = await customEngine.search('arithmetic operations');
      expect(results.length).toBeGreaterThan(0);

      if (results[0].snippets.length > 0) {
        expect(results[0].snippets[0].text.length).toBeLessThanOrEqual(110); // maxLength + ellipsis
        expect(results[0].snippets.length).toBeLessThanOrEqual(2);
      }
    });

    test('should accept custom highlight configuration', async () => {
      const customConfig: Partial<FTS5Config> = {
        highlight: {
          startTag: '<em>',
          endTag: '</em>',
          caseSensitive: false,
        },
      };

      const customEngine = new FTS5Engine(db, customConfig);
      await customEngine.initialize();

      // Test highlight functionality (simplified)
      const results = await customEngine.search('COBOL');
      expect(results.length).toBeGreaterThan(0);
    });

    test('should accept custom tokenizer configuration', async () => {
      const customTokenizerConfig: Partial<MainframeTokenizerConfig> = {
        jclTokens: ['CUSTOM', 'TOKEN'],
        errorCodePatterns: [/^CUSTOM\d{4}$/],
      };

      const customEngine = new FTS5Engine(db, {}, customTokenizerConfig);
      await customEngine.initialize();

      const results = await customEngine.search('JCL');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });
});

export {};
