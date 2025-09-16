/**
 * FTS5 Full-Text Search Tests
 * Comprehensive test suite for FTS5 functionality
 */

const { FTS5Search } = require('../../src/services/search/fts5-search');
const { BM25Ranking } = require('../../src/services/search/bm25-ranking');
const { SnippetGenerator } = require('../../src/services/search/snippet-generator');
const { MainframeTokenizer } = require('../../src/services/search/mainframe-tokenizer');

describe('FTS5 Full-Text Search Suite', () => {
  let searchService;
  let mockDatabase;

  beforeEach(() => {
    // Mock database with FTS5 support
    mockDatabase = {
      prepare: jest.fn(),
      exec: jest.fn(),
      transaction: jest.fn(),
    };

    searchService = new FTS5Search(mockDatabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('FTS5 Basic Functionality', () => {
    test('should initialize FTS5 virtual table correctly', async () => {
      const mockStmt = {
        run: jest.fn(),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      await searchService.initialize();

      expect(mockDatabase.prepare).toHaveBeenCalledWith(
        expect.stringContaining('CREATE VIRTUAL TABLE IF NOT EXISTS fts_knowledge USING fts5')
      );
    });

    test('should insert documents into FTS5 table', async () => {
      const mockStmt = {
        run: jest.fn(),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      const document = {
        id: 'doc1',
        title: 'Mainframe JCL Job Control Language',
        content: 'JCL is used to tell the z/OS operating system about the job you want to run',
        category: 'jcl',
        tags: ['mainframe', 'jcl', 'batch']
      };

      await searchService.addDocument(document);

      expect(mockStmt.run).toHaveBeenCalledWith(
        'doc1',
        document.title,
        document.content,
        document.category,
        JSON.stringify(document.tags)
      );
    });

    test('should perform basic FTS5 search', async () => {
      const mockResults = [
        {
          id: 'doc1',
          title: 'JCL Job Control Language',
          content: 'JCL is used for batch processing',
          rank: 1.0
        }
      ];

      const mockStmt = {
        all: jest.fn().mockReturnValue(mockResults),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      const results = await searchService.search('JCL batch');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: 'doc1',
        title: expect.stringContaining('JCL'),
        rank: expect.any(Number)
      });
    });
  });

  describe('BM25 Ranking Algorithm', () => {
    let bm25Ranking;

    beforeEach(() => {
      bm25Ranking = new BM25Ranking({
        k1: 1.2,
        b: 0.75
      });
    });

    test('should calculate BM25 scores correctly', () => {
      const documents = [
        {
          id: 'doc1',
          content: 'mainframe JCL job control language batch processing',
          length: 7
        },
        {
          id: 'doc2',
          content: 'COBOL programming mainframe legacy systems',
          length: 5
        }
      ];

      const query = ['mainframe', 'JCL'];
      const scores = bm25Ranking.calculateScores(query, documents);

      expect(scores).toHaveLength(2);
      expect(scores[0].score).toBeGreaterThan(scores[1].score); // doc1 should rank higher
      expect(scores[0].id).toBe('doc1');
    });

    test('should handle term frequency correctly', () => {
      const document = {
        id: 'doc1',
        content: 'mainframe mainframe mainframe JCL',
        length: 4
      };

      const termFreq = bm25Ranking.calculateTermFrequency('mainframe', document);
      expect(termFreq).toBe(3);
    });

    test('should calculate IDF values correctly', () => {
      const documents = [
        { content: 'mainframe JCL' },
        { content: 'mainframe COBOL' },
        { content: 'web development' }
      ];

      const idf = bm25Ranking.calculateIDF('mainframe', documents);
      expect(idf).toBeGreaterThan(0);

      const commonTermIdf = bm25Ranking.calculateIDF('mainframe', documents);
      const rareTermIdf = bm25Ranking.calculateIDF('JCL', documents);
      expect(rareTermIdf).toBeGreaterThan(commonTermIdf);
    });

    test('should rank documents with exact matches higher', () => {
      const documents = [
        {
          id: 'exact',
          content: 'JCL job control language tutorial',
          length: 5
        },
        {
          id: 'partial',
          content: 'mainframe programming with various languages including JCL',
          length: 8
        }
      ];

      const query = ['JCL', 'job', 'control'];
      const scores = bm25Ranking.calculateScores(query, documents);

      expect(scores[0].id).toBe('exact');
      expect(scores[0].score).toBeGreaterThan(scores[1].score);
    });
  });

  describe('Snippet Generation', () => {
    let snippetGenerator;

    beforeEach(() => {
      snippetGenerator = new SnippetGenerator({
        maxLength: 200,
        contextWords: 3
      });
    });

    test('should generate snippets with highlighted terms', () => {
      const content = 'Job Control Language (JCL) is a scripting language used on IBM mainframe operating systems to instruct the system on how to run batch jobs or start subsystems.';
      const query = ['JCL', 'mainframe'];

      const snippet = snippetGenerator.generate(content, query);

      expect(snippet).toContain('<mark>JCL</mark>');
      expect(snippet).toContain('<mark>mainframe</mark>');
      expect(snippet.length).toBeLessThanOrEqual(200);
    });

    test('should handle case-insensitive highlighting', () => {
      const content = 'COBOL and cobol programming on Mainframe systems';
      const query = ['cobol', 'mainframe'];

      const snippet = snippetGenerator.generate(content, query);

      expect(snippet).toContain('<mark>COBOL</mark>');
      expect(snippet).toContain('<mark>cobol</mark>');
      expect(snippet).toContain('<mark>Mainframe</mark>');
    });

    test('should prioritize multiple query terms proximity', () => {
      const content = 'This document covers JCL basics. Later sections discuss mainframe architecture. JCL and mainframe work together seamlessly.';
      const query = ['JCL', 'mainframe'];

      const snippet = snippetGenerator.generate(content, query);

      // Should prefer the section where both terms appear close together
      expect(snippet).toContain('JCL and mainframe work together');
    });

    test('should handle overlapping highlights correctly', () => {
      const content = 'Job Control Language JCL programming';
      const query = ['Job Control Language', 'JCL'];

      const snippet = snippetGenerator.generate(content, query);

      // Should not have nested or broken mark tags
      expect(snippet).not.toMatch(/<mark>.*<mark>/);
      expect(snippet).not.toMatch(/mark>.*mark>/);
    });
  });

  describe('Mainframe Tokenizer', () => {
    let tokenizer;

    beforeEach(() => {
      tokenizer = new MainframeTokenizer({
        preserveAcronyms: true,
        customTerms: ['JCL', 'COBOL', 'CICS', 'IMS', 'DB2', 'z/OS', 'MVS']
      });
    });

    test('should preserve mainframe acronyms', () => {
      const text = 'JCL COBOL CICS IMS DB2 programming';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('JCL');
      expect(tokens).toContain('COBOL');
      expect(tokens).toContain('CICS');
      expect(tokens).toContain('IMS');
      expect(tokens).toContain('DB2');
    });

    test('should handle special mainframe notation', () => {
      const text = 'z/OS operating system with MVS/ESA';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('z/OS');
      expect(tokens).toContain('MVS/ESA');
    });

    test('should normalize common variations', () => {
      const variations = [
        'JCL job control language',
        'Job Control Language (JCL)',
        'job-control-language'
      ];

      variations.forEach(text => {
        const tokens = tokenizer.tokenize(text);
        expect(tokens).toContain('JCL');
        expect(tokens).toContain('job');
        expect(tokens).toContain('control');
        expect(tokens).toContain('language');
      });
    });

    test('should handle dataset naming conventions', () => {
      const text = 'SYS1.PROCLIB dataset USER.TEST.DATA';
      const tokens = tokenizer.tokenize(text);

      expect(tokens).toContain('SYS1.PROCLIB');
      expect(tokens).toContain('USER.TEST.DATA');
      expect(tokens).toContain('dataset');
    });

    test('should extract meaningful stems for search', () => {
      const text = 'programming programmer programmed programs';
      const tokens = tokenizer.tokenize(text);
      const stems = tokenizer.stem(tokens);

      // All should stem to similar base
      const uniqueStems = [...new Set(stems)];
      expect(uniqueStems.length).toBeLessThan(tokens.length);
    });
  });

  describe('Advanced Search Features', () => {
    test('should support phrase search', async () => {
      const mockResults = [
        {
          id: 'doc1',
          title: 'JCL Tutorial',
          content: 'Job Control Language basics',
          rank: 1.0
        }
      ];

      const mockStmt = {
        all: jest.fn().mockReturnValue(mockResults),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      const results = await searchService.search('"Job Control Language"');

      expect(mockStmt.all).toHaveBeenCalledWith(
        expect.stringContaining('"Job Control Language"')
      );
    });

    test('should support boolean operators', async () => {
      const mockStmt = {
        all: jest.fn().mockReturnValue([]),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      await searchService.search('JCL AND COBOL');
      expect(mockStmt.all).toHaveBeenCalledWith(
        expect.stringContaining('JCL AND COBOL')
      );

      await searchService.search('JCL OR COBOL');
      expect(mockStmt.all).toHaveBeenCalledWith(
        expect.stringContaining('JCL OR COBOL')
      );

      await searchService.search('mainframe NOT legacy');
      expect(mockStmt.all).toHaveBeenCalledWith(
        expect.stringContaining('mainframe NOT legacy')
      );
    });

    test('should support wildcard search', async () => {
      const mockStmt = {
        all: jest.fn().mockReturnValue([]),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      await searchService.search('program*');
      expect(mockStmt.all).toHaveBeenCalledWith(
        expect.stringContaining('program*')
      );
    });

    test('should support field-specific search', async () => {
      const mockStmt = {
        all: jest.fn().mockReturnValue([]),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      await searchService.search('title:JCL');
      expect(mockStmt.all).toHaveBeenCalledWith(
        expect.stringContaining('title:JCL')
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed queries gracefully', async () => {
      const mockStmt = {
        all: jest.fn().mockImplementation(() => {
          throw new Error('FTS5 syntax error');
        }),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      const result = await searchService.search('invalid"query');

      expect(result).toEqual([]);
      // Should log error but not throw
    });

    test('should handle empty search queries', async () => {
      const result = await searchService.search('');
      expect(result).toEqual([]);

      const resultNull = await searchService.search(null);
      expect(resultNull).toEqual([]);

      const resultUndefined = await searchService.search(undefined);
      expect(resultUndefined).toEqual([]);
    });

    test('should handle database connection errors', async () => {
      mockDatabase.prepare.mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      const result = await searchService.search('test query');
      expect(result).toEqual([]);
    });
  });
});