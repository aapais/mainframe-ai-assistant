/**
 * BM25 Ranking Algorithm Unit Tests
 * Detailed tests for BM25 scoring accuracy
 */

const { BM25Ranking } = require('../../../src/services/search/bm25-ranking');

describe('BM25 Ranking Algorithm', () => {
  let bm25;

  beforeEach(() => {
    bm25 = new BM25Ranking({
      k1: 1.2,      // Controls term frequency scaling
      b: 0.75,      // Controls document length normalization
      epsilon: 0.25 // Minimum IDF value
    });
  });

  describe('Core BM25 Calculations', () => {
    test('should calculate term frequency correctly', () => {
      const document = {
        content: 'mainframe mainframe programming mainframe systems',
        tokens: ['mainframe', 'mainframe', 'programming', 'mainframe', 'systems']
      };

      expect(bm25.getTermFrequency('mainframe', document)).toBe(3);
      expect(bm25.getTermFrequency('programming', document)).toBe(1);
      expect(bm25.getTermFrequency('nonexistent', document)).toBe(0);
    });

    test('should calculate document frequency correctly', () => {
      const corpus = [
        { tokens: ['mainframe', 'JCL'] },
        { tokens: ['mainframe', 'COBOL'] },
        { tokens: ['web', 'development'] },
        { tokens: ['mainframe', 'systems'] }
      ];

      expect(bm25.getDocumentFrequency('mainframe', corpus)).toBe(3);
      expect(bm25.getDocumentFrequency('JCL', corpus)).toBe(1);
      expect(bm25.getDocumentFrequency('nonexistent', corpus)).toBe(0);
    });

    test('should calculate IDF with epsilon floor', () => {
      const corpus = [
        { tokens: ['common'] },
        { tokens: ['common'] },
        { tokens: ['common'] }
      ];

      const idf = bm25.calculateIDF('common', corpus);
      expect(idf).toBeGreaterThanOrEqual(0.25); // epsilon floor

      const rareTermIdf = bm25.calculateIDF('rare', corpus);
      expect(rareTermIdf).toBeGreaterThan(idf);
    });

    test('should calculate average document length', () => {
      const corpus = [
        { length: 10 },
        { length: 20 },
        { length: 30 }
      ];

      const avgLength = bm25.calculateAverageDocumentLength(corpus);
      expect(avgLength).toBe(20);
    });
  });

  describe('BM25 Score Calculation', () => {
    test('should score documents correctly for single term', () => {
      const corpus = [
        {
          id: 'doc1',
          tokens: ['mainframe', 'programming'],
          length: 2
        },
        {
          id: 'doc2',
          tokens: ['mainframe', 'mainframe', 'systems'],
          length: 3
        }
      ];

      const scores = bm25.calculateScores(['mainframe'], corpus);

      expect(scores).toHaveLength(2);
      expect(scores[0].score).toBeGreaterThan(0);
      expect(scores[1].score).toBeGreaterThan(0);

      // doc2 should score higher due to higher term frequency
      const doc2Score = scores.find(s => s.id === 'doc2').score;
      const doc1Score = scores.find(s => s.id === 'doc1').score;
      expect(doc2Score).toBeGreaterThan(doc1Score);
    });

    test('should score multi-term queries correctly', () => {
      const corpus = [
        {
          id: 'doc1',
          tokens: ['mainframe', 'JCL', 'programming'],
          length: 3
        },
        {
          id: 'doc2',
          tokens: ['mainframe', 'COBOL', 'development'],
          length: 3
        },
        {
          id: 'doc3',
          tokens: ['JCL', 'batch', 'processing'],
          length: 3
        }
      ];

      const scores = bm25.calculateScores(['mainframe', 'JCL'], corpus);

      // doc1 should score highest (contains both terms)
      // doc2 and doc3 should score lower (contain only one term each)
      const sortedScores = scores.sort((a, b) => b.score - a.score);
      expect(sortedScores[0].id).toBe('doc1');
    });

    test('should handle document length normalization', () => {
      const corpus = [
        {
          id: 'short',
          tokens: ['mainframe'],
          length: 1
        },
        {
          id: 'long',
          tokens: Array(100).fill('filler').concat(['mainframe']),
          length: 101
        }
      ];

      const scores = bm25.calculateScores(['mainframe'], corpus);

      const shortScore = scores.find(s => s.id === 'short').score;
      const longScore = scores.find(s => s.id === 'long').score;

      // Shorter document should score higher due to length normalization
      expect(shortScore).toBeGreaterThan(longScore);
    });
  });

  describe('Parameter Sensitivity', () => {
    test('should respond to k1 parameter changes', () => {
      const corpus = [
        {
          id: 'doc1',
          tokens: ['term', 'term', 'term'],
          length: 3
        }
      ];

      const lowK1 = new BM25Ranking({ k1: 0.5, b: 0.75 });
      const highK1 = new BM25Ranking({ k1: 2.0, b: 0.75 });

      const lowK1Scores = lowK1.calculateScores(['term'], corpus);
      const highK1Scores = highK1.calculateScores(['term'], corpus);

      // Higher k1 should give more weight to term frequency
      expect(highK1Scores[0].score).toBeGreaterThan(lowK1Scores[0].score);
    });

    test('should respond to b parameter changes', () => {
      const corpus = [
        {
          id: 'short',
          tokens: ['term'],
          length: 1
        },
        {
          id: 'long',
          tokens: Array(50).fill('filler').concat(['term']),
          length: 51
        }
      ];

      const lowB = new BM25Ranking({ k1: 1.2, b: 0.0 });  // No length normalization
      const highB = new BM25Ranking({ k1: 1.2, b: 1.0 }); // Full length normalization

      const lowBScores = lowB.calculateScores(['term'], corpus);
      const highBScores = highB.calculateScores(['term'], corpus);

      const lowBRatio = lowBScores.find(s => s.id === 'short').score /
                       lowBScores.find(s => s.id === 'long').score;
      const highBRatio = highBScores.find(s => s.id === 'short').score /
                        highBScores.find(s => s.id === 'long').score;

      // Higher b should create bigger difference between short and long docs
      expect(highBRatio).toBeGreaterThan(lowBRatio);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty corpus', () => {
      const scores = bm25.calculateScores(['term'], []);
      expect(scores).toEqual([]);
    });

    test('should handle empty query', () => {
      const corpus = [{ id: 'doc1', tokens: ['term'], length: 1 }];
      const scores = bm25.calculateScores([], corpus);
      expect(scores).toHaveLength(1);
      expect(scores[0].score).toBe(0);
    });

    test('should handle documents with no matching terms', () => {
      const corpus = [
        { id: 'doc1', tokens: ['different', 'terms'], length: 2 }
      ];

      const scores = bm25.calculateScores(['nonmatching'], corpus);
      expect(scores[0].score).toBe(0);
    });

    test('should handle zero-length documents', () => {
      const corpus = [
        { id: 'empty', tokens: [], length: 0 },
        { id: 'normal', tokens: ['term'], length: 1 }
      ];

      const scores = bm25.calculateScores(['term'], corpus);
      expect(scores).toHaveLength(2);
      expect(scores.find(s => s.id === 'empty').score).toBe(0);
      expect(scores.find(s => s.id === 'normal').score).toBeGreaterThan(0);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should handle large corpus efficiently', () => {
      const largeCorpus = Array.from({ length: 10000 }, (_, i) => ({
        id: `doc${i}`,
        tokens: [`term${i % 100}`, 'common', 'word'],
        length: 3
      }));

      const startTime = Date.now();
      const scores = bm25.calculateScores(['common'], largeCorpus);
      const endTime = Date.now();

      expect(scores).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should handle complex queries efficiently', () => {
      const corpus = Array.from({ length: 1000 }, (_, i) => ({
        id: `doc${i}`,
        tokens: [`mainframe`, 'JCL', 'COBOL', 'CICS', 'IMS', 'DB2'],
        length: 6
      }));

      const complexQuery = ['mainframe', 'JCL', 'COBOL', 'CICS', 'IMS'];

      const startTime = Date.now();
      const scores = bm25.calculateScores(complexQuery, corpus);
      const endTime = Date.now();

      expect(scores).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(500); // Should be fast for complex queries
    });
  });

  describe('Ranking Quality', () => {
    test('should rank exact matches higher than partial matches', () => {
      const corpus = [
        {
          id: 'exact',
          tokens: ['JCL', 'job', 'control', 'language'],
          length: 4
        },
        {
          id: 'partial',
          tokens: ['JCL', 'programming', 'guide', 'tutorial', 'examples'],
          length: 5
        }
      ];

      const scores = bm25.calculateScores(['JCL', 'job', 'control', 'language'], corpus);
      const sortedScores = scores.sort((a, b) => b.score - a.score);

      expect(sortedScores[0].id).toBe('exact');
    });

    test('should prefer documents with terms closer together', () => {
      // This is more about the tokenizer and snippet generation,
      // but BM25 should at least not penalize proximity
      const corpus = [
        {
          id: 'close',
          tokens: ['mainframe', 'JCL', 'batch'],
          length: 3
        },
        {
          id: 'distant',
          tokens: ['mainframe', 'filler', 'filler', 'filler', 'JCL', 'filler', 'batch'],
          length: 7
        }
      ];

      const scores = bm25.calculateScores(['mainframe', 'JCL', 'batch'], corpus);

      // Both should have same term frequencies, but close should score higher due to length
      const closeScore = scores.find(s => s.id === 'close').score;
      const distantScore = scores.find(s => s.id === 'distant').score;
      expect(closeScore).toBeGreaterThan(distantScore);
    });
  });
});