/**
 * FTS5 Search Performance Tests
 * Benchmarks and performance validation for search functionality
 */

const { FTS5Search } = require('../../../src/services/search/fts5-search');
const { BM25Ranking } = require('../../../src/services/search/bm25-ranking');
const { performance } = require('perf_hooks');

describe('Search Performance Tests', () => {
  let searchService;
  let mockDatabase;
  let performanceMetrics = {};

  beforeAll(() => {
    // Setup performance monitoring
    performanceMetrics.startTime = performance.now();
  });

  beforeEach(() => {
    mockDatabase = {
      prepare: jest.fn(),
      exec: jest.fn(),
      transaction: jest.fn(),
    };

    searchService = new FTS5Search(mockDatabase);
  });

  afterAll(() => {
    performanceMetrics.endTime = performance.now();
    console.log(`Total test execution time: ${performanceMetrics.endTime - performanceMetrics.startTime}ms`);
  });

  describe('Database Query Performance', () => {
    test('should execute simple queries within performance threshold', async () => {
      const mockResults = generateMockResults(100);
      const mockStmt = {
        all: jest.fn().mockReturnValue(mockResults),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      const startTime = performance.now();
      await searchService.search('JCL programming');
      const endTime = performance.now();

      const queryTime = endTime - startTime;
      expect(queryTime).toBeLessThan(50); // Should complete in under 50ms
    });

    test('should handle complex boolean queries efficiently', async () => {
      const mockResults = generateMockResults(500);
      const mockStmt = {
        all: jest.fn().mockReturnValue(mockResults),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      const complexQueries = [
        '(JCL AND COBOL) OR (mainframe AND programming)',
        'mainframe NOT legacy AND (batch OR online)',
        '"job control language" AND z/OS',
        'program* AND (JCL OR COBOL OR CICS)'
      ];

      for (const query of complexQueries) {
        const startTime = performance.now();
        await searchService.search(query);
        const endTime = performance.now();

        const queryTime = endTime - startTime;
        expect(queryTime).toBeLessThan(100); // Complex queries under 100ms
      }
    });

    test('should maintain performance with large result sets', async () => {
      const largeResultSet = generateMockResults(10000);
      const mockStmt = {
        all: jest.fn().mockReturnValue(largeResultSet),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      const startTime = performance.now();
      await searchService.search('mainframe');
      const endTime = performance.now();

      const queryTime = endTime - startTime;
      expect(queryTime).toBeLessThan(200); // Large results under 200ms
    });
  });

  describe('BM25 Ranking Performance', () => {
    test('should calculate scores efficiently for medium corpus', () => {
      const bm25 = new BM25Ranking();
      const corpus = generateCorpus(1000);
      const query = ['mainframe', 'JCL', 'programming'];

      const startTime = performance.now();
      const scores = bm25.calculateScores(query, corpus);
      const endTime = performance.now();

      const calculationTime = endTime - startTime;
      expect(calculationTime).toBeLessThan(100); // 1K docs under 100ms
      expect(scores).toHaveLength(1000);
    });

    test('should scale linearly with corpus size', () => {
      const bm25 = new BM25Ranking();
      const query = ['mainframe', 'JCL'];

      const sizes = [100, 500, 1000, 2000];
      const times = [];

      sizes.forEach(size => {
        const corpus = generateCorpus(size);

        const startTime = performance.now();
        bm25.calculateScores(query, corpus);
        const endTime = performance.now();

        times.push(endTime - startTime);
      });

      // Check that scaling is roughly linear (within 2x tolerance)
      const ratio1 = times[1] / times[0]; // 500/100
      const ratio2 = times[2] / times[1]; // 1000/500
      const ratio3 = times[3] / times[2]; // 2000/1000

      expect(ratio1).toBeLessThan(8); // Should not be exponential
      expect(ratio2).toBeLessThan(4);
      expect(ratio3).toBeLessThan(4);
    });

    test('should handle concurrent scoring efficiently', async () => {
      const bm25 = new BM25Ranking();
      const corpus = generateCorpus(500);
      const queries = [
        ['mainframe'],
        ['JCL', 'programming'],
        ['COBOL', 'batch'],
        ['z/OS', 'systems']
      ];

      const startTime = performance.now();

      const promises = queries.map(query =>
        Promise.resolve(bm25.calculateScores(query, corpus))
      );

      await Promise.all(promises);
      const endTime = performance.now();

      const concurrentTime = endTime - startTime;
      expect(concurrentTime).toBeLessThan(200); // All concurrent under 200ms
    });
  });

  describe('Snippet Generation Performance', () => {
    test('should generate snippets quickly for long documents', () => {
      const { SnippetGenerator } = require('../../../src/services/search/snippet-generator');
      const generator = new SnippetGenerator();

      const longContent = generateLongContent(10000); // 10K words
      const query = ['mainframe', 'JCL', 'programming'];

      const startTime = performance.now();
      const snippet = generator.generate(longContent, query);
      const endTime = performance.now();

      const generationTime = endTime - startTime;
      expect(generationTime).toBeLessThan(50); // 10K words under 50ms
      expect(snippet).toContain('<mark>');
    });

    test('should handle multiple queries efficiently', () => {
      const { SnippetGenerator } = require('../../../src/services/search/snippet-generator');
      const generator = new SnippetGenerator();

      const content = generateLongContent(1000);
      const queries = [
        ['mainframe'],
        ['JCL', 'COBOL'],
        ['batch', 'processing', 'systems'],
        ['z/OS', 'operating', 'system']
      ];

      const startTime = performance.now();

      queries.forEach(query => {
        generator.generate(content, query);
      });

      const endTime = performance.now();

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(100); // Multiple snippets under 100ms
    });
  });

  describe('Tokenization Performance', () => {
    test('should tokenize large documents efficiently', () => {
      const { MainframeTokenizer } = require('../../../src/services/search/mainframe-tokenizer');
      const tokenizer = new MainframeTokenizer();

      const largeText = generateMainframeContent(50000); // 50K characters

      const startTime = performance.now();
      const tokens = tokenizer.tokenize(largeText);
      const endTime = performance.now();

      const tokenizationTime = endTime - startTime;
      expect(tokenizationTime).toBeLessThan(100); // 50K chars under 100ms
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('should stem tokens efficiently', () => {
      const { MainframeTokenizer } = require('../../../src/services/search/mainframe-tokenizer');
      const tokenizer = new MainframeTokenizer({ stemming: true });

      const tokens = Array.from({ length: 10000 }, (_, i) => `program${i % 100}`);

      const startTime = performance.now();
      const stems = tokenizer.stem(tokens);
      const endTime = performance.now();

      const stemmingTime = endTime - startTime;
      expect(stemmingTime).toBeLessThan(200); // 10K tokens under 200ms
      expect(stems).toHaveLength(tokens.length);
    });
  });

  describe('Memory Usage', () => {
    test('should not leak memory during repeated operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const mockResults = generateMockResults(10);
        const mockStmt = {
          all: jest.fn().mockReturnValue(mockResults),
        };
        mockDatabase.prepare.mockReturnValue(mockStmt);

        // Don't await to avoid timing overhead
        searchService.search(`test query ${i}`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (under 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle large data structures efficiently', () => {
      const bm25 = new BM25Ranking();
      const initialMemory = process.memoryUsage().heapUsed;

      // Create large corpus
      const largeCorpus = generateCorpus(10000);
      const query = ['mainframe', 'JCL'];

      bm25.calculateScores(query, largeCorpus);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not use excessive memory for calculations
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Under 100MB
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent searches without performance degradation', async () => {
      const mockResults = generateMockResults(100);
      const mockStmt = {
        all: jest.fn().mockReturnValue(mockResults),
      };
      mockDatabase.prepare.mockReturnValue(mockStmt);

      const queries = Array.from({ length: 50 }, (_, i) => `query ${i}`);

      const startTime = performance.now();

      const promises = queries.map(query => searchService.search(query));
      await Promise.all(promises);

      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const avgTimePerQuery = totalTime / queries.length;

      expect(avgTimePerQuery).toBeLessThan(10); // Under 10ms average per query
    });
  });

  describe('Performance Regression Tests', () => {
    test('should maintain baseline performance for standard queries', async () => {
      // Baseline expectations based on typical search scenarios
      const testCases = [
        { query: 'JCL', expectedResults: 50, maxTime: 30 },
        { query: 'mainframe programming', expectedResults: 100, maxTime: 50 },
        { query: 'COBOL AND batch', expectedResults: 75, maxTime: 60 },
        { query: '"job control language"', expectedResults: 25, maxTime: 40 }
      ];

      for (const testCase of testCases) {
        const mockResults = generateMockResults(testCase.expectedResults);
        const mockStmt = {
          all: jest.fn().mockReturnValue(mockResults),
        };
        mockDatabase.prepare.mockReturnValue(mockStmt);

        const startTime = performance.now();
        const results = await searchService.search(testCase.query);
        const endTime = performance.now();

        const queryTime = endTime - startTime;
        expect(queryTime).toBeLessThan(testCase.maxTime);
        expect(results).toHaveLength(testCase.expectedResults);
      }
    });
  });
});

// Helper functions
function generateMockResults(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `doc${i}`,
    title: `Document ${i} about mainframe JCL COBOL`,
    content: `This is document ${i} content about programming on mainframe systems using JCL and COBOL`,
    rank: Math.random()
  }));
}

function generateCorpus(size) {
  const terms = ['mainframe', 'JCL', 'COBOL', 'CICS', 'IMS', 'DB2', 'z/OS', 'batch', 'programming', 'systems'];

  return Array.from({ length: size }, (_, i) => {
    const numTerms = Math.floor(Math.random() * 10) + 5;
    const tokens = Array.from({ length: numTerms }, () =>
      terms[Math.floor(Math.random() * terms.length)]
    );

    return {
      id: `doc${i}`,
      tokens,
      length: tokens.length
    };
  });
}

function generateLongContent(wordCount) {
  const words = [
    'mainframe', 'JCL', 'COBOL', 'programming', 'batch', 'processing', 'systems',
    'job', 'control', 'language', 'procedure', 'dataset', 'allocation', 'step',
    'program', 'execution', 'z/OS', 'MVS', 'TSO', 'ISPF', 'SDSF', 'utilities'
  ];

  return Array.from({ length: wordCount }, (_, i) => {
    if (i > 0 && i % 20 === 0) return '\n'; // Add line breaks
    return words[Math.floor(Math.random() * words.length)];
  }).join(' ');
}

function generateMainframeContent(charCount) {
  const content = `
    Job Control Language (JCL) is a scripting language used on IBM mainframe operating systems
    to instruct the system on how to run batch jobs or start subsystems. JCL identifies the
    program to be executed, the datasets to be used, and other job-related information.

    COBOL (Common Business-Oriented Language) is a compiled English-like computer programming
    language designed for business use. It is an imperative, procedural and object-oriented
    programming language. COBOL is primarily used in business, finance, and administrative
    systems for companies and governments.

    z/OS is a 64-bit operating system for IBM z/Architecture mainframes. z/OS is described
    as the successor to OS/390, which was the successor to MVS. z/OS offers the attributes
    you need to support continuous operations for demanding workloads.
  `.repeat(Math.ceil(charCount / 1000));

  return content.substring(0, charCount);
}