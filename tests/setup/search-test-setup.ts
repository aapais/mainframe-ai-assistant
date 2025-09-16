/**
 * Search System Test Setup
 * Specialized configuration and utilities for testing intelligent search components
 */

import { jest } from '@jest/globals';
import { TestDataFactory } from './test-setup';

// Mock search engine components
export class MockInvertedIndex {
  private documents = new Map();
  private termMap = new Map();

  async buildIndex(entries: any[]) {
    entries.forEach(entry => {
      this.documents.set(entry.id, entry);
      // Simplified indexing
      const terms = entry.title.toLowerCase().split(' ');
      terms.forEach(term => {
        if (!this.termMap.has(term)) {
          this.termMap.set(term, new Set());
        }
        this.termMap.get(term).add(entry.id);
      });
    });
  }

  search(terms: string[]) {
    const results = new Map();
    terms.forEach(term => {
      if (this.termMap.has(term.toLowerCase())) {
        const docIds = this.termMap.get(term.toLowerCase());
        docIds.forEach(docId => {
          results.set(docId, {
            docId,
            positions: [0],
            frequency: 1
          });
        });
      }
    });
    return results;
  }

  findTermsWithPrefix(prefix: string, limit: number = 10) {
    const matches = Array.from(this.termMap.keys())
      .filter(term => term.startsWith(prefix.toLowerCase()))
      .slice(0, limit);
    return matches;
  }

  getDocument(docId: string) {
    return this.documents.get(docId);
  }

  addDocument(doc: any) {
    this.documents.set(doc.id, doc);
  }

  removeDocument(docId: string) {
    return this.documents.delete(docId);
  }

  getStats() {
    return {
      totalDocuments: this.documents.size,
      totalTerms: this.termMap.size,
      averageDocumentLength: 100,
    };
  }

  optimizeIndex() {
    return Promise.resolve();
  }
}

export class MockTextProcessor {
  processText(text: string) {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .map(word => ({
        original: word,
        normalized: word,
        stemmed: word,
        position: 0
      }));
  }

  tokenizeQuery(query: string) {
    return query.toLowerCase().split(/\s+/);
  }

  getStats() {
    return {
      totalProcessed: 100,
      averageProcessingTime: 5,
    };
  }
}

export class MockQueryParser {
  parse(query: string, options: any = {}) {
    return {
      originalQuery: query,
      terms: query.toLowerCase().split(/\s+/),
      operators: [],
      filters: {},
      options
    };
  }

  extractSearchTerms(parsedQuery: any) {
    return {
      required: parsedQuery.terms,
      optional: [],
      phrases: []
    };
  }
}

export class MockFuzzyMatcher {
  suggest(term: string, vocabulary: string[], limit: number = 3) {
    // Simple fuzzy matching simulation
    return vocabulary
      .filter(word =>
        word.includes(term) ||
        this.levenshteinDistance(word, term) <= 2
      )
      .slice(0, limit);
  }

  clearCache() {
    // Mock implementation
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    return matrix[b.length][a.length];
  }
}

export class MockRankingEngine {
  rankDocuments(parsedQuery: any, postingLists: any, collection: any, options: any) {
    // Simulate ranking algorithm
    const docIds = Array.from(postingLists.keys());
    return docIds.map((docId, index) => ({
      docId,
      score: 100 - (index * 10), // Decreasing scores
      explanation: `Ranked #${index + 1} by ${options.algorithm || 'mock'} algorithm`
    }));
  }

  clearCache() {
    // Mock implementation
  }

  getStats() {
    return {
      totalRankings: 50,
      averageRankingTime: 25,
    };
  }
}

export class MockSearchCache {
  private cache = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    hitRate: 0
  };

  constructor(config: any = {}) {
    // Mock initialization
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.cache.has(key)) {
      this.stats.hits++;
      this.updateHitRate();
      return this.cache.get(key);
    } else {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.cache.set(key, value);
  }

  async deletePattern(pattern: string): Promise<void> {
    const keys = Array.from(this.cache.keys());
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    keys.forEach(key => {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    });
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async close(): Promise<void> {
    this.cache.clear();
  }

  generateQueryCacheKey(query: string, options: any): string {
    return `search:${query}:${JSON.stringify(options)}`;
  }

  async warmCache(data: any): Promise<void> {
    // Mock cache warming
  }

  getStats() {
    return this.stats;
  }

  private updateHitRate() {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
}

// Mock Gemini API Service
export class MockGeminiService {
  private mockResponses = new Map();

  constructor() {
    this.setupDefaultResponses();
  }

  async findSimilar(query: string, entries: any[]) {
    const response = this.mockResponses.get('findSimilar') || [];

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return response.slice(0, Math.min(5, entries.length)).map((score: number, index: number) => ({
      entry: entries[index],
      score,
      matchType: 'ai'
    }));
  }

  async explainError(errorCode: string) {
    await new Promise(resolve => setTimeout(resolve, 200));
    return `Mock explanation for error code: ${errorCode}`;
  }

  setMockResponse(method: string, response: any) {
    this.mockResponses.set(method, response);
  }

  simulateNetworkError() {
    throw new Error('Network error: Unable to connect to Gemini API');
  }

  simulateTimeout() {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 5000);
    });
  }

  private setupDefaultResponses() {
    this.mockResponses.set('findSimilar', [95, 87, 73, 65, 52]);
  }
}

// Test fixtures
export const createTestKBEntries = (count: number = 10) => {
  const entries = [];
  const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'];
  const problems = [
    'Status 35 error when opening VSAM file',
    'Job fails with S0C7 data exception',
    'Dataset not found during job execution',
    'DB2 connection timeout error',
    'Memory allocation failure in batch job'
  ];
  const solutions = [
    'Check file catalog and permissions',
    'Verify numeric field initialization',
    'Validate dataset name and allocation',
    'Increase connection timeout settings',
    'Optimize memory usage and cleanup'
  ];

  for (let i = 0; i < count; i++) {
    entries.push(TestDataFactory.createKBEntry({
      title: `Test Problem ${i + 1}`,
      problem: problems[i % problems.length],
      solution: solutions[i % solutions.length],
      category: categories[i % categories.length],
      tags: [`tag${i}`, `category${i % 3}`, 'test'],
      usage_count: Math.floor(Math.random() * 100),
      success_count: Math.floor(Math.random() * 80),
      failure_count: Math.floor(Math.random() * 20)
    }));
  }

  return entries;
};

// Performance test utilities
export const performanceThresholds = {
  search: {
    fast: 100,      // < 100ms
    acceptable: 500, // < 500ms
    slow: 1000      // < 1s (maximum)
  },
  indexing: {
    small: 1000,    // < 1s for small datasets
    medium: 5000,   // < 5s for medium datasets
    large: 15000    // < 15s for large datasets
  },
  cache: {
    hit: 10,        // < 10ms cache hit
    miss: 50        // < 50ms cache miss + db query
  }
};

export const measureSearchPerformance = async (searchFn: () => Promise<any>) => {
  const startTime = performance.now();
  const startMemory = measureMemoryUsage();

  const result = await searchFn();

  const endTime = performance.now();
  const endMemory = measureMemoryUsage();

  return {
    result,
    metrics: {
      executionTime: endTime - startTime,
      memoryDelta: endMemory ? endMemory.used - (startMemory?.used || 0) : 0,
      timestamp: new Date().toISOString()
    }
  };
};

// Mock function to measure memory usage (fallback for test environment)
const measureMemoryUsage = () => {
  if (typeof performance !== 'undefined' && performance.memory) {
    return {
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
    };
  }
  // Return mock values for testing
  return {
    used: Math.floor(Math.random() * 100) * 1024 * 1024, // Random MB usage
    total: 512 * 1024 * 1024, // 512MB
    limit: 1024 * 1024 * 1024, // 1GB
  };
};

// Search test scenarios
export const searchTestScenarios = {
  // Basic scenarios
  exactMatch: {
    query: 'VSAM Status 35',
    expectedResults: 3,
    expectedTopScore: 95
  },
  fuzzyMatch: {
    query: 'VSAM Staus 35', // Typo
    expectedResults: 2,
    expectedTopScore: 85
  },
  partialMatch: {
    query: 'Status',
    expectedResults: 5,
    expectedTopScore: 75
  },
  noResults: {
    query: 'xyz123nonexistent',
    expectedResults: 0,
    expectedTopScore: 0
  },

  // Performance scenarios
  largeDataset: {
    datasetSize: 10000,
    query: 'error',
    maxResponseTime: 1000
  },
  complexQuery: {
    query: 'VSAM OR DB2 AND (error OR timeout)',
    maxResponseTime: 500
  },

  // Edge cases
  emptyQuery: {
    query: '',
    expectedError: true
  },
  specialCharacters: {
    query: 'S0C7 @#$%',
    expectedResults: 1
  },
  longQuery: {
    query: 'a'.repeat(1000),
    maxResponseTime: 1000
  }
};

export default {
  MockInvertedIndex,
  MockTextProcessor,
  MockQueryParser,
  MockFuzzyMatcher,
  MockRankingEngine,
  MockSearchCache,
  MockGeminiService,
  createTestKBEntries,
  performanceThresholds,
  measureSearchPerformance,
  searchTestScenarios
};