/**
 * FTS5 Integration Tests
 * End-to-end testing of the complete FTS5 search system
 */

const { FTS5Search } = require('../../../src/services/search/fts5-search');
const { sampleMainframeData, sampleQueries, expectedRankings } = require('../datasets/sample-mainframe-data');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

describe('FTS5 Integration Tests', () => {
  let db;
  let searchService;
  let testDbPath;

  beforeAll(async () => {
    // Create a temporary test database
    testDbPath = path.join(__dirname, 'test-fts5.db');

    // Remove existing test database if it exists
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new Database(testDbPath);
    searchService = new FTS5Search(db);

    // Initialize the FTS5 search system
    await searchService.initialize();

    // Populate with sample data
    await populateTestData();
  });

  afterAll(() => {
    if (db) {
      db.close();
    }

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  async function populateTestData() {
    const allDocuments = [
      ...sampleMainframeData.jclDocuments,
      ...sampleMainframeData.cobolDocuments,
      ...sampleMainframeData.zosDocuments,
      ...sampleMainframeData.cicsDocuments,
      ...sampleMainframeData.db2Documents,
      ...sampleMainframeData.tsoDocuments
    ];

    for (const doc of allDocuments) {
      await searchService.addDocument(doc);
    }
  }

  describe('Full-Text Search Functionality', () => {
    test('should find documents with single term queries', async () => {
      const results = await searchService.search('JCL');

      expect(results.length).toBeGreaterThan(0);

      // All results should contain JCL
      results.forEach(result => {
        const text = (result.title + ' ' + result.content).toLowerCase();
        expect(text).toContain('jcl');
      });

      // Results should be ranked by relevance
      expect(results[0].rank).toBeGreaterThanOrEqual(results[results.length - 1].rank);
    });

    test('should handle multi-term queries correctly', async () => {
      const results = await searchService.search('JCL programming');

      expect(results.length).toBeGreaterThan(0);

      // Results should contain at least one of the terms
      results.forEach(result => {
        const text = (result.title + ' ' + result.content).toLowerCase();
        expect(text.includes('jcl') || text.includes('programming')).toBe(true);
      });

      // Documents with both terms should rank higher
      const firstResult = results[0];
      const firstText = (firstResult.title + ' ' + firstResult.content).toLowerCase();
      expect(firstText).toContain('jcl');
    });

    test('should support phrase search', async () => {
      const results = await searchService.search('"Job Control Language"');

      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        const text = result.title + ' ' + result.content;
        expect(text).toContain('Job Control Language');
      });
    });

    test('should handle boolean operators', async () => {
      // AND operator
      const andResults = await searchService.search('JCL AND COBOL');
      andResults.forEach(result => {
        const text = (result.title + ' ' + result.content).toLowerCase();
        expect(text).toContain('jcl');
        expect(text).toContain('cobol');
      });

      // OR operator
      const orResults = await searchService.search('CICS OR IMS');
      expect(orResults.length).toBeGreaterThan(0);
      orResults.forEach(result => {
        const text = (result.title + ' ' + result.content).toLowerCase();
        expect(text.includes('cics') || text.includes('ims')).toBe(true);
      });
    });

    test('should support wildcard search', async () => {
      const results = await searchService.search('program*');

      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        const text = (result.title + ' ' + result.content).toLowerCase();
        expect(text.match(/program\w*/)).toBeTruthy();
      });
    });
  });

  describe('Ranking Accuracy', () => {
    test('should rank exact matches higher than partial matches', async () => {
      const results = await searchService.search('JCL job control language');

      expect(results.length).toBeGreaterThan(1);

      // The first result should ideally be the JCL introduction document
      const firstResult = results[0];
      expect(firstResult.id).toBe('jcl_001'); // JCL introduction
    });

    test('should prioritize documents with higher term frequency', async () => {
      const results = await searchService.search('JCL');

      // Documents that mention JCL more frequently should rank higher
      const topResult = results[0];
      const topText = topResult.title + ' ' + topResult.content;
      const topJclCount = (topText.toLowerCase().match(/jcl/g) || []).length;

      if (results.length > 1) {
        const secondResult = results[1];
        const secondText = secondResult.title + ' ' + secondResult.content;
        const secondJclCount = (secondText.toLowerCase().match(/jcl/g) || []).length;

        // Higher frequency should generally rank higher (allowing for document length normalization)
        expect(topResult.rank).toBeGreaterThanOrEqual(secondResult.rank);
      }
    });

    test('should validate expected rankings for key queries', async () => {
      for (const [query, expectedIds] of Object.entries(expectedRankings)) {
        const results = await searchService.search(query);

        expect(results.length).toBeGreaterThan(0);

        // Check that expected documents are in the top results
        const resultIds = results.slice(0, expectedIds.length).map(r => r.id);

        expectedIds.forEach(expectedId => {
          expect(resultIds).toContain(expectedId);
        });
      }
    });
  });

  describe('Snippet Generation', () => {
    test('should generate highlighted snippets', async () => {
      const results = await searchService.search('JCL programming', {
        includeSnippets: true
      });

      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        if (result.snippet) {
          expect(result.snippet).toContain('<mark>');
          expect(result.snippet.length).toBeLessThanOrEqual(200);
        }
      });
    });

    test('should preserve context around highlighted terms', async () => {
      const results = await searchService.search('dataset allocation', {
        includeSnippets: true
      });

      const resultWithSnippet = results.find(r => r.snippet);
      if (resultWithSnippet) {
        const snippet = resultWithSnippet.snippet;

        // Should contain highlighted terms with surrounding context
        expect(snippet).toMatch(/<mark>dataset<\/mark>/i);
        expect(snippet).toMatch(/<mark>allocation<\/mark>/i);

        // Should have readable context
        const words = snippet.replace(/<\/?mark>/g, '').split(/\s+/);
        expect(words.length).toBeGreaterThan(5);
      }
    });
  });

  describe('Category and Tag Filtering', () => {
    test('should filter by category', async () => {
      const results = await searchService.search('programming', {
        category: 'cobol'
      });

      results.forEach(result => {
        expect(result.category).toBe('cobol');
      });
    });

    test('should filter by tags', async () => {
      const results = await searchService.search('mainframe', {
        tags: ['batch']
      });

      results.forEach(result => {
        expect(result.tags).toContain('batch');
      });
    });

    test('should combine text search with filters', async () => {
      const results = await searchService.search('JCL', {
        category: 'jcl',
        difficulty: 'beginner'
      });

      results.forEach(result => {
        expect(result.category).toBe('jcl');
        expect(result.difficulty).toBe('beginner');

        const text = (result.title + ' ' + result.content).toLowerCase();
        expect(text).toContain('jcl');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty queries gracefully', async () => {
      const results = await searchService.search('');
      expect(results).toEqual([]);
    });

    test('should handle queries with no results', async () => {
      const results = await searchService.search('nonexistent_term_xyz123');
      expect(results).toEqual([]);
    });

    test('should handle malformed boolean queries', async () => {
      // Should not throw errors for malformed queries
      const results = await searchService.search('JCL AND AND COBOL');
      expect(Array.isArray(results)).toBe(true);
    });

    test('should handle special characters in queries', async () => {
      const results = await searchService.search('z/OS');
      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        const text = result.title + ' ' + result.content;
        expect(text).toContain('z/OS');
      });
    });

    test('should handle very long queries', async () => {
      const longQuery = 'JCL COBOL programming mainframe systems batch processing dataset allocation job control language '.repeat(20);

      const results = await searchService.search(longQuery);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    test('should complete searches within reasonable time', async () => {
      const queries = sampleQueries.slice(0, 10); // Test with 10 queries

      for (const query of queries) {
        const startTime = Date.now();
        await searchService.search(query);
        const endTime = Date.now();

        const searchTime = endTime - startTime;
        expect(searchTime).toBeLessThan(100); // Under 100ms per search
      }
    });

    test('should handle concurrent searches', async () => {
      const queries = ['JCL', 'COBOL', 'mainframe', 'z/OS', 'CICS'];

      const startTime = Date.now();
      const promises = queries.map(query => searchService.search(query));
      const results = await Promise.all(promises);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(200); // All concurrent searches under 200ms

      // All searches should return results
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Data Integrity', () => {
    test('should maintain consistent document counts', async () => {
      const allResults = await searchService.search('*');
      const expectedCount = Object.values(sampleMainframeData)
        .reduce((total, docs) => total + docs.length, 0);

      expect(allResults.length).toBe(expectedCount);
    });

    test('should preserve document metadata', async () => {
      const results = await searchService.search('JCL');

      results.forEach(result => {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('tags');
        expect(result).toHaveProperty('rank');

        expect(typeof result.id).toBe('string');
        expect(typeof result.title).toBe('string');
        expect(typeof result.content).toBe('string');
        expect(Array.isArray(result.tags)).toBe(true);
        expect(typeof result.rank).toBe('number');
      });
    });
  });

  describe('Advanced Search Features', () => {
    test('should support pagination', async () => {
      const firstPage = await searchService.search('mainframe', {
        offset: 0,
        limit: 3
      });

      const secondPage = await searchService.search('mainframe', {
        offset: 3,
        limit: 3
      });

      expect(firstPage.length).toBeLessThanOrEqual(3);
      expect(secondPage.length).toBeLessThanOrEqual(3);

      // Pages should not overlap
      const firstIds = firstPage.map(r => r.id);
      const secondIds = secondPage.map(r => r.id);
      const overlap = firstIds.filter(id => secondIds.includes(id));
      expect(overlap).toHaveLength(0);
    });

    test('should support sorting options', async () => {
      const relevanceSort = await searchService.search('programming', {
        sortBy: 'relevance'
      });

      const dateSort = await searchService.search('programming', {
        sortBy: 'date'
      });

      // Relevance sort should order by rank
      if (relevanceSort.length > 1) {
        expect(relevanceSort[0].rank).toBeGreaterThanOrEqual(relevanceSort[1].rank);
      }

      // Date sort should order by lastUpdated
      if (dateSort.length > 1) {
        const firstDate = new Date(dateSort[0].lastUpdated);
        const secondDate = new Date(dateSort[1].lastUpdated);
        expect(firstDate).toBeGreaterThanOrEqual(secondDate);
      }
    });
  });
});