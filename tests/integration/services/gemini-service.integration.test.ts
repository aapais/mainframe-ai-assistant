/**
 * Gemini Service Integration Tests
 * 
 * Comprehensive integration testing for the GeminiService focusing on:
 * - API communication with rate limiting and retry logic
 * - Fallback to local search on API failure
 * - Response parsing and validation
 * - Semantic matching accuracy
 * - Performance under various loads
 * - Mock strategies for API responses
 * 
 * @author Service Testing Specialist
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { GeminiService, GeminiConfig, MatchResult } from '../../../src/services/GeminiService';
import { KBEntry, SearchResult } from '../../../src/types';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Mock axios for controlled testing
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Test configuration constants
const TEST_CONFIG = {
  API_TIMEOUT: 5000,              // 5 second timeout
  RETRY_ATTEMPTS: 3,              // Retry failed requests
  RATE_LIMIT_WINDOW: 60000,       // 1 minute rate limit window
  MAX_REQUESTS_PER_MINUTE: 60,    // API rate limit
  SEMANTIC_ACCURACY_THRESHOLD: 0.8, // Minimum accuracy for semantic matching
  PERFORMANCE_THRESHOLD: 2000,    // Max response time in ms
  FALLBACK_ACCURACY_THRESHOLD: 0.6, // Fallback search accuracy
} as const;

/**
 * Test data generators for KB entries
 */
class TestDataGenerator {
  static createKBEntry(overrides: Partial<KBEntry> = {}): KBEntry {
    return {
      id: `kb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: 'VSAM Status 35 - File Not Found',
      problem: 'Job abends with VSAM status code 35. Program cannot open VSAM file for processing.',
      solution: '1. Verify dataset exists using LISTCAT\n2. Check DD statement DSN parameter\n3. Verify RACF permissions\n4. Check catalog entry',
      category: 'VSAM',
      tags: ['vsam', 'status-35', 'file-error', 'catalog'],
      created_at: new Date(),
      updated_at: new Date(),
      created_by: 'test-user',
      usage_count: 10,
      success_count: 8,
      failure_count: 2,
      version: 1,
      ...overrides
    };
  }

  static createKBEntrySet(count: number): KBEntry[] {
    const entries: KBEntry[] = [];
    const templates = [
      {
        title: 'S0C7 Data Exception',
        problem: 'Program abends with S0C7 data exception during arithmetic operation',
        solution: 'Check for uninitialized COMP-3 fields and invalid packed decimal data',
        category: 'Batch',
        tags: ['s0c7', 'data-exception', 'abend', 'numeric']
      },
      {
        title: 'JCL Dataset Not Found',
        problem: 'Job fails with IEF212I dataset not found error',
        solution: 'Verify dataset name spelling and check if dataset exists',
        category: 'JCL',
        tags: ['jcl', 'dataset', 'ief212i', 'allocation']
      },
      {
        title: 'DB2 SQLCODE -904',
        problem: 'Program receives SQLCODE -904 resource unavailable',
        solution: 'Check database status and run COPY if needed',
        category: 'DB2',
        tags: ['db2', 'sqlcode', '-904', 'resource']
      },
      {
        title: 'CICS ASRA Abend',
        problem: 'CICS transaction abends with ASRA program check',
        solution: 'Check CEDF for exact offset and review program listing',
        category: 'CICS',
        tags: ['cics', 'asra', 'abend', 'program-check']
      },
      {
        title: 'Sort WER027A Error',
        problem: 'DFSORT fails with WER027A insufficient storage',
        solution: 'Increase REGION parameter and add DYNALLOC',
        category: 'Batch',
        tags: ['sort', 'dfsort', 'wer027a', 'storage']
      }
    ];

    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      entries.push(this.createKBEntry({
        ...template,
        id: `kb-${i}`,
        usage_count: Math.floor(Math.random() * 100),
        success_count: Math.floor(Math.random() * 50),
        failure_count: Math.floor(Math.random() * 10)
      }));
    }

    return entries;
  }
}

/**
 * Mock API response generator
 */
class MockAPIResponses {
  static createSuccessResponse(entries: KBEntry[], query: string): any {
    // Simulate Gemini API response format
    const matches = entries.slice(0, 5).map((entry, index) => {
      const confidence = Math.max(50, 95 - index * 10);
      const reasoning = `Matches ${query} with ${confidence}% confidence`;
      return `${index}:${confidence}:${reasoning}`;
    }).join('\n');

    return {
      candidates: [{
        content: {
          parts: [{
            text: matches
          }]
        }
      }]
    };
  }

  static createErrorResponse(status: number, message: string): any {
    const error = new Error(message);
    (error as any).response = {
      status,
      data: { error: { message } }
    };
    return error;
  }

  static createTimeoutResponse(): any {
    const error = new Error('Timeout');
    (error as any).code = 'ECONNABORTED';
    return error;
  }

  static createRateLimitResponse(): any {
    return this.createErrorResponse(429, 'Rate limit exceeded');
  }

  static createMalformedResponse(): any {
    return {
      candidates: [{
        content: {
          parts: [{
            text: 'Invalid response format without proper indices'
          }]
        }
      }]
    };
  }
}

/**
 * Rate limiting test helper
 */
class RateLimitingHelper {
  private requestTimes: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = TEST_CONFIG.RATE_LIMIT_WINDOW, maxRequests: number = TEST_CONFIG.MAX_REQUESTS_PER_MINUTE) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(time => now - time < this.windowMs);
    return this.requestTimes.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requestTimes.push(Date.now());
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requestTimes = this.requestTimes.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - this.requestTimes.length);
  }

  getTimeUntilReset(): number {
    if (this.requestTimes.length === 0) return 0;
    const oldestRequest = Math.min(...this.requestTimes);
    return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
  }
}

/**
 * Performance monitoring helper
 */
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  startTimer(operation: string): () => number {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(operation, duration);
      return duration;
    };
  }

  recordMetric(operation: string, value: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(value);
  }

  getStats(operation: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(operation);
    if (!values || values.length === 0) return null;

    return {
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  reset(): void {
    this.metrics.clear();
  }
}

describe('GeminiService Integration Tests', () => {
  let geminiService: GeminiService;
  let testConfig: GeminiConfig;
  let testEntries: KBEntry[];
  let rateLimiter: RateLimitingHelper;
  let performanceMonitor: PerformanceMonitor;

  beforeAll(() => {
    // Setup test environment
    testConfig = {
      apiKey: 'test-api-key-12345',
      model: 'gemini-pro',
      temperature: 0.3,
      maxTokens: 1024,
      timeout: TEST_CONFIG.API_TIMEOUT
    };

    testEntries = TestDataGenerator.createKBEntrySet(20);
    rateLimiter = new RateLimitingHelper();
    performanceMonitor = new PerformanceMonitor();

    console.log('🔧 Gemini Service integration test setup complete');
  });

  beforeEach(() => {
    geminiService = new GeminiService(testConfig);
    mockedAxios.create.mockReturnValue(mockedAxios);
    performanceMonitor.reset();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('API Communication and Authentication', () => {
    it('should successfully communicate with Gemini API', async () => {
      // Arrange
      const query = 'VSAM file not found error';
      const mockResponse = MockAPIResponses.createSuccessResponse(testEntries, query);
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const endTimer = performanceMonitor.startTimer('api_communication');

      // Act
      const results = await geminiService.findSimilar(query, testEntries, 5);
      const duration = endTimer();

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/models/gemini-pro:generateContent'),
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining(query)
                })
              ])
            })
          ])
        }),
        undefined
      );

      expect(results).toHaveLength(5);
      expect(results[0].matchType).toBe('ai');
      expect(results[0].score).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(TEST_CONFIG.PERFORMANCE_THRESHOLD);
    });

    it('should handle API authentication errors gracefully', async () => {
      // Arrange
      const query = 'authentication test';
      const authError = MockAPIResponses.createErrorResponse(401, 'Invalid API key');
      mockedAxios.post.mockRejectedValueOnce(authError);

      // Act
      const results = await geminiService.findSimilar(query, testEntries, 5);

      // Assert
      expect(results).toHaveLength(5); // Should fallback to local search
      expect(results[0].matchType).toBe('fuzzy');
    });

    it('should implement retry logic with exponential backoff', async () => {
      // Arrange
      const query = 'retry test';
      const networkError = MockAPIResponses.createTimeoutResponse();
      const successResponse = MockAPIResponses.createSuccessResponse(testEntries, query);

      mockedAxios.post
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ data: successResponse });

      // Act
      const startTime = Date.now();
      const results = await geminiService.findSimilar(query, testEntries, 3);
      const totalTime = Date.now() - startTime;

      // Assert
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);
      expect(results[0].matchType).toBe('ai');
      // Should have some delay due to retry backoff
      expect(totalTime).toBeGreaterThan(100);
    });
  });

  describe('Rate Limiting and Request Management', () => {
    it('should respect API rate limits', async () => {
      // Arrange
      const query = 'rate limit test';
      const requests: Promise<SearchResult[]>[] = [];

      // Mock responses for rate limit testing
      for (let i = 0; i < 10; i++) {
        if (i < 5) {
          mockedAxios.post.mockResolvedValueOnce({
            data: MockAPIResponses.createSuccessResponse(testEntries, query)
          });
        } else {
          mockedAxios.post.mockRejectedValueOnce(MockAPIResponses.createRateLimitResponse());
        }
      }

      // Act - Make multiple rapid requests
      for (let i = 0; i < 10; i++) {
        requests.push(geminiService.findSimilar(query, testEntries.slice(0, 3), 3));
      }

      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // Assert
      expect(successful.length).toBeGreaterThan(0);
      // Even failed requests should fallback to local search
      expect(failed.length).toBe(0);
    });

    it('should handle concurrent requests efficiently', async () => {
      // Arrange
      const queries = [
        'VSAM error handling',
        'JCL dataset allocation',
        'DB2 connection issues',
        'CICS transaction abend',
        'Sort utility problems'
      ];

      queries.forEach(query => {
        mockedAxios.post.mockResolvedValueOnce({
          data: MockAPIResponses.createSuccessResponse(testEntries, query)
        });
      });

      const endTimer = performanceMonitor.startTimer('concurrent_requests');

      // Act - Execute concurrent requests
      const requests = queries.map(query => 
        geminiService.findSimilar(query, testEntries, 3)
      );

      const results = await Promise.all(requests);
      const duration = endTimer();

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toHaveLength(3);
        expect(result[0].matchType).toBe('ai');
      });

      // Concurrent requests should be faster than sequential
      expect(duration).toBeLessThan(TEST_CONFIG.PERFORMANCE_THRESHOLD * 2);
    });
  });

  describe('Response Parsing and Validation', () => {
    it('should parse valid Gemini API responses correctly', async () => {
      // Arrange
      const query = 'parse test';
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: '0:95:Exact match for VSAM Status 35\n1:85:Similar file access error\n2:70:Related allocation issue'
            }]
          }
        }]
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // Act
      const results = await geminiService.findSimilar(query, testEntries, 5);

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].score).toBe(95);
      expect(results[0].highlights).toContain('Exact match for VSAM Status 35');
      expect(results[1].score).toBe(85);
      expect(results[2].score).toBe(70);
    });

    it('should handle malformed API responses gracefully', async () => {
      // Arrange
      const query = 'malformed response test';
      const malformedResponse = MockAPIResponses.createMalformedResponse();
      mockedAxios.post.mockResolvedValueOnce({ data: malformedResponse });

      // Act
      const results = await geminiService.findSimilar(query, testEntries, 5);

      // Assert
      // Should fallback to local search when parsing fails
      expect(results).toHaveLength(5);
      expect(results[0].matchType).toBe('fuzzy');
    });

    it('should validate confidence scores and filter low-quality results', async () => {
      // Arrange
      const query = 'confidence filtering test';
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: '0:95:High confidence match\n1:75:Medium confidence match\n2:45:Low confidence match\n3:25:Very low confidence'
            }]
          }
        }]
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // Act
      const results = await geminiService.findSimilar(query, testEntries, 10);

      // Assert
      // Should filter out results with confidence < 50
      expect(results).toHaveLength(2);
      expect(results[0].score).toBe(95);
      expect(results[1].score).toBe(75);
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(50);
      });
    });
  });

  describe('Semantic Matching Accuracy', () => {
    it('should demonstrate semantic understanding beyond keyword matching', async () => {
      // Arrange
      const query = 'program crashes with arithmetic error';
      const relevantEntry = TestDataGenerator.createKBEntry({
        title: 'S0C7 Data Exception',
        problem: 'Application abends with S0C7 during calculation',
        solution: 'Check numeric field initialization',
        tags: ['s0c7', 'data-exception', 'numeric']
      });

      const irrelevantEntry = TestDataGenerator.createKBEntry({
        title: 'Network Connection Issue',
        problem: 'Cannot connect to remote server',
        solution: 'Check network configuration',
        tags: ['network', 'connection', 'server']
      });

      const entries = [irrelevantEntry, relevantEntry];
      
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: '1:90:S0C7 data exception matches arithmetic error semantically'
            }]
          }
        }]
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // Act
      const results = await geminiService.findSimilar(query, entries, 5);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].entry.title).toBe('S0C7 Data Exception');
      expect(results[0].score).toBe(90);
      expect(results[0].highlights).toContain('arithmetic error semantically');
    });

    it('should handle synonyms and related concepts correctly', async () => {
      // Arrange
      const testCases = [
        {
          query: 'dataset not found',
          expectedCategory: 'JCL',
          expectedTerms: ['ief212i', 'allocation', 'dataset']
        },
        {
          query: 'file access error',
          expectedCategory: 'VSAM',
          expectedTerms: ['vsam', 'status', 'file']
        },
        {
          query: 'transaction failure',
          expectedCategory: 'CICS',
          expectedTerms: ['cics', 'abend', 'transaction']
        }
      ];

      for (const testCase of testCases) {
        const mockResponse = MockAPIResponses.createSuccessResponse(testEntries, testCase.query);
        mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

        // Act
        const results = await geminiService.findSimilar(testCase.query, testEntries, 3);

        // Assert
        expect(results).toHaveLength(3);
        const topResult = results[0];
        expect(topResult.entry.category).toBe(testCase.expectedCategory);
        
        const entryText = `${topResult.entry.title} ${topResult.entry.problem} ${topResult.entry.tags.join(' ')}`.toLowerCase();
        const hasExpectedTerms = testCase.expectedTerms.some(term => 
          entryText.includes(term.toLowerCase())
        );
        expect(hasExpectedTerms).toBe(true);
      }
    });
  });

  describe('Fallback Mechanisms', () => {
    it('should fallback to local search when API is unavailable', async () => {
      // Arrange
      const query = 'vsam status error';
      const networkError = new Error('Network unreachable');
      mockedAxios.post.mockRejectedValue(networkError);

      const endTimer = performanceMonitor.startTimer('fallback_search');

      // Act
      const results = await geminiService.findSimilar(query, testEntries, 5);
      const duration = endTimer();

      // Assert
      expect(results).toHaveLength(5);
      expect(results[0].matchType).toBe('fuzzy');
      expect(duration).toBeLessThan(1000); // Local search should be fast
      
      // Verify fallback quality
      const relevantResults = results.filter(r => 
        r.entry.title.toLowerCase().includes('vsam') || 
        r.entry.tags.some(tag => tag.includes('vsam'))
      );
      expect(relevantResults.length).toBeGreaterThan(0);
    });

    it('should maintain search quality in fallback mode', async () => {
      // Arrange
      const testQueries = [
        'S0C7 data exception',
        'JCL dataset allocation',
        'VSAM file access',
        'DB2 resource unavailable',
        'CICS transaction abend'
      ];

      // Force fallback for all requests
      mockedAxios.post.mockRejectedValue(new Error('API unavailable'));

      // Act & Assert
      for (const query of testQueries) {
        const results = await geminiService.findSimilar(query, testEntries, 3);
        
        expect(results).toHaveLength(3);
        expect(results[0].matchType).toBe('fuzzy');
        expect(results[0].score).toBeGreaterThan(0);
        
        // Verify results contain query-relevant terms
        const topResult = results[0];
        const entryText = `${topResult.entry.title} ${topResult.entry.problem}`.toLowerCase();
        const queryTerms = query.toLowerCase().split(' ');
        const hasRelevantTerms = queryTerms.some(term => 
          term.length > 3 && entryText.includes(term)
        );
        expect(hasRelevantTerms).toBe(true);
      }
    });

    it('should provide consistent performance in fallback mode', async () => {
      // Arrange
      const queries = Array(10).fill('fallback performance test');
      mockedAxios.post.mockRejectedValue(new Error('API unavailable'));

      const durations: number[] = [];

      // Act
      for (const query of queries) {
        const endTimer = performanceMonitor.startTimer('fallback_performance');
        await geminiService.findSimilar(query, testEntries, 5);
        durations.push(endTimer());
      }

      // Assert
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      
      expect(avgDuration).toBeLessThan(500); // Average should be very fast
      expect(maxDuration).toBeLessThan(1000); // Even worst case should be reasonable
      
      // Performance should be consistent
      const standardDeviation = Math.sqrt(
        durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length
      );
      expect(standardDeviation).toBeLessThan(avgDuration * 0.5); // Low variance
    });
  });

  describe('Error Explanation Feature', () => {
    it('should provide detailed error explanations', async () => {
      // Arrange
      const errorCode = 'S0C7';
      const mockExplanation = `S0C7 Data Exception:
1. Invalid numeric data in arithmetic operation
2. Common causes: uninitialized COMP-3 fields, corrupted packed decimal
3. Resolution: Check field initialization and data validation
4. Prevention: Use NUMERIC test before arithmetic operations`;

      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: mockExplanation
            }]
          }
        }]
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // Act
      const explanation = await geminiService.explainError(errorCode);

      // Assert
      expect(explanation).toContain('S0C7');
      expect(explanation).toContain('numeric data');
      expect(explanation).toContain('COMP-3');
      expect(explanation).toContain('arithmetic');
    });

    it('should fallback to predefined explanations for common errors', async () => {
      // Arrange
      const commonErrors = ['S0C7', 'S0C4', 'S806', 'IEF212I'];
      mockedAxios.post.mockRejectedValue(new Error('API unavailable'));

      // Act & Assert
      for (const errorCode of commonErrors) {
        const explanation = await geminiService.explainError(errorCode);
        
        expect(explanation).toBeTruthy();
        expect(explanation.length).toBeGreaterThan(50);
        expect(explanation.toLowerCase()).toContain(errorCode.toLowerCase());
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large knowledge base efficiently', async () => {
      // Arrange
      const largeKBSet = TestDataGenerator.createKBEntrySet(1000);
      const query = 'performance test with large dataset';
      
      const mockResponse = MockAPIResponses.createSuccessResponse(largeKBSet.slice(0, 20), query);
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      const endTimer = performanceMonitor.startTimer('large_dataset_search');

      // Act
      const results = await geminiService.findSimilar(query, largeKBSet, 10);
      const duration = endTimer();

      // Assert
      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(TEST_CONFIG.PERFORMANCE_THRESHOLD);
      
      // Verify API was called with limited entries (due to token constraints)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringMatching(/\[0\].*\[19\]/) // Should contain entries 0-19
                })
              ])
            })
          ])
        }),
        undefined
      );
    });

    it('should maintain quality with reduced entry sets', async () => {
      // Arrange
      const fullKBSet = TestDataGenerator.createKBEntrySet(100);
      const query = 'VSAM file access error';
      
      // Ensure first 30 entries include relevant VSAM entries
      fullKBSet[0] = TestDataGenerator.createKBEntry({
        title: 'VSAM Status 35 Error',
        category: 'VSAM',
        tags: ['vsam', 'status-35', 'file-access']
      });

      const mockResponse = MockAPIResponses.createSuccessResponse(fullKBSet.slice(0, 30), query);
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // Act
      const results = await geminiService.findSimilar(query, fullKBSet, 5);

      // Assert
      expect(results).toHaveLength(5);
      
      // Top result should be relevant
      const topResult = results[0];
      expect(topResult.entry.title).toContain('VSAM');
      expect(topResult.score).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Integration with Knowledge Base Categories', () => {
    it('should respect category preferences in search results', async () => {
      // Arrange
      const query = 'categorized search test';
      const categorizedEntries = [
        TestDataGenerator.createKBEntry({ category: 'VSAM', title: 'VSAM Issue' }),
        TestDataGenerator.createKBEntry({ category: 'JCL', title: 'JCL Issue' }),
        TestDataGenerator.createKBEntry({ category: 'DB2', title: 'DB2 Issue' }),
        TestDataGenerator.createKBEntry({ category: 'CICS', title: 'CICS Issue' }),
        TestDataGenerator.createKBEntry({ category: 'Batch', title: 'Batch Issue' })
      ];

      const mockResponse = MockAPIResponses.createSuccessResponse(categorizedEntries, query);
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // Act
      const results = await geminiService.findSimilar(query, categorizedEntries, 5);

      // Assert
      expect(results).toHaveLength(5);
      
      // Verify all major categories are represented
      const categories = results.map(r => r.entry.category);
      const uniqueCategories = [...new Set(categories)];
      expect(uniqueCategories.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Memory Management and Resource Cleanup', () => {
    it('should handle memory efficiently with large responses', async () => {
      // Arrange
      const query = 'memory test';
      const largeResponseText = Array(1000).fill(0).map((_, i) => 
        `${i}:${50 + i % 50}:Memory test entry ${i}`
      ).join('\n');

      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: largeResponseText
            }]
          }
        }]
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // Act
      const results = await geminiService.findSimilar(query, testEntries, 50);

      // Assert
      expect(results.length).toBeLessThanOrEqual(50);
      // Should filter based on confidence and available entries
      expect(results.length).toBeGreaterThan(0);
      
      // Verify results are properly filtered
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(50);
        expect(result.entry).toBeDefined();
      });
    });

    it('should cleanup resources properly after operations', async () => {
      // Arrange
      const initialMemoryUsage = process.memoryUsage().heapUsed;
      const operations = 10;

      // Act - Perform multiple operations
      for (let i = 0; i < operations; i++) {
        const mockResponse = MockAPIResponses.createSuccessResponse(testEntries, `test-${i}`);
        mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });
        
        await geminiService.findSimilar(`test query ${i}`, testEntries, 5);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemoryUsage = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemoryUsage - initialMemoryUsage;

      // Assert
      // Memory increase should be reasonable (less than 10MB for these operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  afterAll(() => {
    // Print performance summary
    const apiStats = performanceMonitor.getStats('api_communication');
    const fallbackStats = performanceMonitor.getStats('fallback_search');
    const concurrentStats = performanceMonitor.getStats('concurrent_requests');

    console.log('\n📊 Gemini Service Performance Summary:');
    if (apiStats) {
      console.log(`   API Communication: ${apiStats.avg.toFixed(2)}ms avg (${apiStats.count} calls)`);
    }
    if (fallbackStats) {
      console.log(`   Fallback Search: ${fallbackStats.avg.toFixed(2)}ms avg (${fallbackStats.count} calls)`);
    }
    if (concurrentStats) {
      console.log(`   Concurrent Requests: ${concurrentStats.avg.toFixed(2)}ms avg (${concurrentStats.count} calls)`);
    }

    console.log('✅ Gemini Service integration tests completed');
  });
});