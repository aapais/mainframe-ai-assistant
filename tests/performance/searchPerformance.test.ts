/**
 * Performance Tests for Search Functionality
 * Validates <500ms local search requirement and overall performance
 */

import { performance } from 'perf_hooks';
import Database from 'better-sqlite3';
import { HybridSearchService } from '../../src/renderer/services/hybridSearchService';
import { SearchService } from '../../src/renderer/services/api/SearchService';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import { KBEntry, KBCategory } from '../../src/types/services';
import { promises as fs } from 'fs';
import path from 'path';

describe('Search Performance Tests', () => {
  let db: Database.Database;
  let knowledgeDB: KnowledgeDB;
  let hybridSearchService: HybridSearchService;
  let tempDbPath: string;
  
  // Performance thresholds
  const PERFORMANCE_THRESHOLDS = {
    LOCAL_SEARCH_MAX_TIME: 500, // UC001 requirement
    BULK_SEARCH_MAX_TIME: 1000,
    CONCURRENT_SEARCH_MAX_TIME: 750,
    LARGE_DATASET_MAX_TIME: 800,
    AI_SEARCH_MAX_TIME: 10000,
    AUTHORIZATION_MAX_TIME: 1000
  };

  // Generate large test dataset
  const generateTestEntries = (count: number): KBEntry[] => {
    const categories: KBCategory[] = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'];
    const entries: KBEntry[] = [];
    
    for (let i = 0; i < count; i++) {
      const category = categories[i % categories.length];
      entries.push({
        id: `test-entry-${i.toString().padStart(6, '0')}`,
        title: `Test Entry ${i} - ${category} Performance Issue`,
        problem: `This is test problem ${i} for performance testing in ${category} category. ` +
                `It contains various keywords like error, status, code, handling, processing, ` +
                `optimization, and troubleshooting to test search performance.`,
        solution: `Solution for test entry ${i} involves systematic analysis and resolution steps. ` +
                 `This includes diagnostic procedures, code review, performance optimization, ` +
                 `and preventive measures to avoid similar issues.`,
        category,
        tags: [
          `test-${i}`,
          category.toLowerCase(),
          'performance-test',
          `tag-${i % 10}`,
          i % 2 === 0 ? 'even' : 'odd'
        ],
        created_at: new Date(2024, 0, 1 + (i % 365)),
        updated_at: new Date(2024, 0, 1 + (i % 365)),
        usage_count: Math.floor(Math.random() * 100),
        success_rate: 0.7 + (Math.random() * 0.3),
        version: 1,
        status: 'active',
        created_by: `test-user-${i % 10}`
      });
    }
    
    return entries;
  };

  beforeAll(async () => {
    // Create temporary database with large dataset
    tempDbPath = path.join(__dirname, '../../temp', `perf-test-${Date.now()}.db`);
    await fs.mkdir(path.dirname(tempDbPath), { recursive: true });
    
    db = new Database(tempDbPath);
    knowledgeDB = new KnowledgeDB(tempDbPath);
    
    await knowledgeDB.initialize();
    
    // Insert large test dataset (1000 entries)
    const testEntries = generateTestEntries(1000);
    console.log(`Inserting ${testEntries.length} test entries for performance testing...`);
    
    const batchSize = 100;
    for (let i = 0; i < testEntries.length; i += batchSize) {
      const batch = testEntries.slice(i, i + batchSize);
      await Promise.all(batch.map(entry => knowledgeDB.saveEntry(entry)));
    }
    
    console.log('Test data insertion completed.');
  });

  beforeEach(() => {
    hybridSearchService = new HybridSearchService();
    
    // Inject test database
    const searchService = (hybridSearchService as any).searchService;
    (searchService as any).knowledgeDB = knowledgeDB;
  });

  afterAll(async () => {
    if (db) {
      db.close();
    }
    
    try {
      await fs.unlink(tempDbPath);
    } catch (error) {
      console.warn('Failed to cleanup test database:', error);
    }
  });

  describe('UC001 Performance Requirement - Local Search <500ms', () => {
    it('should complete simple queries within 500ms', async () => {
      const queries = ['VSAM', 'error', 'status', 'DB2', 'JCL'];
      
      for (const query of queries) {
        const startTime = performance.now();
        
        const result = await hybridSearchService.search(query, undefined, { enableAI: false });
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
        expect(result.performance.localSearchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
        expect(result.performance.localCompleted).toBe(true);
        
        console.log(`Query "${query}" completed in ${searchTime.toFixed(2)}ms`);
      }
    });

    it('should complete complex queries within 500ms', async () => {
      const complexQueries = [
        'VSAM status code 35 file not found error',
        'DB2 SQL -803 duplicate key primary index',
        'JCL syntax error step name validation rules',
        'COBOL S0C7 data exception COMP-3 field handling',
        'batch processing error handling best practices optimization'
      ];
      
      for (const query of complexQueries) {
        const startTime = performance.now();
        
        const result = await hybridSearchService.search(query, undefined, { enableAI: false });
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
        expect(result.performance.localSearchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
        
        console.log(`Complex query completed in ${searchTime.toFixed(2)}ms (${result.localResults.length} results)`);
      }
    });

    it('should complete category-filtered searches within 500ms', async () => {
      const categories: KBCategory[] = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'];
      
      for (const category of categories) {
        const startTime = performance.now();
        
        const result = await hybridSearchService.search('error handling', category, { enableAI: false });
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
        expect(result.performance.localSearchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
        
        console.log(`Category ${category} search completed in ${searchTime.toFixed(2)}ms`);
      }
    });

    it('should maintain performance with large result sets', async () => {
      const startTime = performance.now();
      
      // Query that should return many results
      const result = await hybridSearchService.search('test', undefined, { 
        enableAI: false,
        maxLocalResults: 100
      });
      
      const endTime = performance.now();
      const searchTime = endTime - startTime;
      
      expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
      expect(result.localResults.length).toBeGreaterThan(50); // Should find many results
      
      console.log(`Large result set search (${result.localResults.length} results) completed in ${searchTime.toFixed(2)}ms`);
    });

    it('should handle fuzzy search within performance limits', async () => {
      const fuzzyQueries = [
        'VSEM status', // VSAM typo
        'erro handeling', // error handling typos
        'databse problm', // database problem typos
        'bacht procesing' // batch processing typos
      ];
      
      for (const query of fuzzyQueries) {
        const startTime = performance.now();
        
        const result = await hybridSearchService.search(query, undefined, { enableAI: false });
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
        
        console.log(`Fuzzy query "${query}" completed in ${searchTime.toFixed(2)}ms`);
      }
    });
  });

  describe('Concurrent Search Performance', () => {
    it('should handle multiple concurrent searches efficiently', async () => {
      const concurrentQueries = [
        'VSAM error',
        'DB2 performance',
        'JCL syntax',
        'batch processing',
        'error handling',
        'status codes',
        'optimization tips',
        'troubleshooting guide'
      ];
      
      const startTime = performance.now();
      
      const promises = concurrentQueries.map(query => 
        hybridSearchService.search(query, undefined, { enableAI: false })
      );
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Total time should be reasonable for concurrent execution
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_SEARCH_MAX_TIME);
      
      // Each individual search should still meet requirements
      results.forEach((result, index) => {
        expect(result.performance.localSearchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
        expect(result.performance.localCompleted).toBe(true);
      });
      
      console.log(`${concurrentQueries.length} concurrent searches completed in ${totalTime.toFixed(2)}ms`);
    });

    it('should maintain performance under high concurrent load', async () => {
      const loadTestQueries = Array(20).fill(0).map((_, i) => `test query ${i}`);
      
      const startTime = performance.now();
      
      const promises = loadTestQueries.map(query => 
        hybridSearchService.search(query, undefined, { enableAI: false })
      );
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Average time per search should still be reasonable
      const averageTime = totalTime / loadTestQueries.length;
      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
      
      // All searches should complete successfully
      expect(results).toHaveLength(loadTestQueries.length);
      results.forEach(result => {
        expect(result.performance.localCompleted).toBe(true);
      });
      
      console.log(`High load test: ${loadTestQueries.length} searches, average ${averageTime.toFixed(2)}ms per search`);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should maintain performance with large datasets', async () => {
      const testQueries = [
        'performance',
        'optimization', 
        'error handling',
        'test entry 500',
        'category specific search'
      ];
      
      for (const query of testQueries) {
        const startTime = performance.now();
        
        const result = await hybridSearchService.search(query, undefined, { 
          enableAI: false,
          maxLocalResults: 50
        });
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_DATASET_MAX_TIME);
        expect(result.performance.localCompleted).toBe(true);
        
        console.log(`Large dataset query "${query}" completed in ${searchTime.toFixed(2)}ms (${result.localResults.length} results)`);
      }
    });

    it('should handle pagination efficiently', async () => {
      const query = 'test'; // Should match many entries
      
      // Test different page sizes
      const pageSizes = [10, 25, 50, 100];
      
      for (const pageSize of pageSizes) {
        const startTime = performance.now();
        
        const result = await hybridSearchService.search(query, undefined, { 
          enableAI: false,
          maxLocalResults: pageSize
        });
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
        expect(result.localResults.length).toBeLessThanOrEqual(pageSize);
        
        console.log(`Pagination test: ${pageSize} results in ${searchTime.toFixed(2)}ms`);
      }
    });
  });

  describe('Search Result Quality vs Performance', () => {
    it('should balance relevance and performance', async () => {
      const qualityQueries = [
        { query: 'VSAM status 35', expectedInTop3: 'vsam' },
        { query: 'DB2 SQL error', expectedInTop3: 'db2' },
        { query: 'JCL step error', expectedInTop3: 'jcl' },
        { query: 'batch processing', expectedInTop3: 'batch' }
      ];
      
      for (const { query, expectedInTop3 } of qualityQueries) {
        const startTime = performance.now();
        
        const result = await hybridSearchService.search(query, undefined, { enableAI: false });
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
        
        // Check relevance quality
        const top3Results = result.localResults.slice(0, 3);
        const hasExpectedTerm = top3Results.some(r => 
          r.entry.title.toLowerCase().includes(expectedInTop3) ||
          r.entry.category.toLowerCase().includes(expectedInTop3) ||
          r.entry.tags?.some(tag => tag.toLowerCase().includes(expectedInTop3))
        );
        
        expect(hasExpectedTerm).toBe(true);
        
        console.log(`Quality test "${query}": ${searchTime.toFixed(2)}ms, relevant in top 3: ${hasExpectedTerm}`);
      }
    });

    it('should maintain consistent performance across search patterns', async () => {
      const searchPatterns = [
        'exact match',
        'partial word match',
        'multiple terms search',
        'category:VSAM filter',
        'wildcard * search',
        'phrase "exact phrase"'
      ];
      
      const timings: number[] = [];
      
      for (const pattern of searchPatterns) {
        const startTime = performance.now();
        
        const result = await hybridSearchService.search(pattern, undefined, { enableAI: false });
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        timings.push(searchTime);
        
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
      }
      
      // Check consistency - standard deviation should be reasonable
      const average = timings.reduce((a, b) => a + b, 0) / timings.length;
      const variance = timings.reduce((acc, time) => acc + Math.pow(time - average, 2), 0) / timings.length;
      const stdDev = Math.sqrt(variance);
      
      // Standard deviation should be less than 50% of average
      expect(stdDev).toBeLessThan(average * 0.5);
      
      console.log(`Performance consistency: avg ${average.toFixed(2)}ms, stddev ${stdDev.toFixed(2)}ms`);
    });
  });

  describe('Hybrid Search Performance with AI', () => {
    it('should complete hybrid search within total time limits', async () => {
      // Mock authorization service for testing
      const mockAuthService = {
        requestAuthorization: jest.fn().mockResolvedValue({
          authorized: true,
          action: 'approve',
          requestId: 'perf-test-123',
          autoApproved: false,
          reason: 'Performance test approval'
        })
      };
      
      (hybridSearchService as any).authService = mockAuthService;
      
      const complexQueries = [
        'how to troubleshoot VSAM performance issues',
        'best practices for DB2 optimization',
        'explain the cause of S0C7 abends'
      ];
      
      for (const query of complexQueries) {
        const startTime = performance.now();
        
        const result = await hybridSearchService.search(query);
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        // Local search should still be fast
        expect(result.performance.localSearchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
        
        // Total time including AI should be reasonable
        expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.AI_SEARCH_MAX_TIME);
        
        console.log(`Hybrid search "${query}" completed in ${searchTime.toFixed(2)}ms`);
      }
    });

    it('should measure authorization overhead', async () => {
      const mockAuthService = {
        requestAuthorization: jest.fn().mockImplementation(async () => {
          // Simulate authorization delay
          await new Promise(resolve => setTimeout(resolve, 50));
          return {
            authorized: true,
            action: 'approve',
            requestId: 'auth-perf-test',
            autoApproved: false,
            reason: 'Test approval'
          };
        })
      };
      
      (hybridSearchService as any).authService = mockAuthService;
      
      const startTime = performance.now();
      
      const result = await hybridSearchService.search('complex query requiring authorization');
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(result.performance.authorizationRequired).toBe(true);
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME + PERFORMANCE_THRESHOLDS.AUTHORIZATION_MAX_TIME);
      
      console.log(`Authorization overhead test completed in ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Performance Monitoring and Metrics', () => {
    it('should track performance metrics accurately', async () => {
      const testQueries = ['test 1', 'test 2', 'test 3', 'test 4', 'test 5'];
      
      const performanceData: Array<{
        query: string;
        localTime: number;
        totalTime: number;
        resultCount: number;
      }> = [];
      
      for (const query of testQueries) {
        const result = await hybridSearchService.search(query, undefined, { enableAI: false });
        
        performanceData.push({
          query,
          localTime: result.performance.localSearchTime,
          totalTime: result.performance.totalTime,
          resultCount: result.localResults.length
        });
        
        expect(result.performance.localSearchTime).toBeGreaterThan(0);
        expect(result.performance.totalTime).toBeGreaterThanOrEqual(result.performance.localSearchTime);
      }
      
      // Calculate statistics
      const avgLocalTime = performanceData.reduce((sum, data) => sum + data.localTime, 0) / performanceData.length;
      const maxLocalTime = Math.max(...performanceData.map(data => data.localTime));
      const minLocalTime = Math.min(...performanceData.map(data => data.localTime));
      
      console.log(`Performance metrics: avg ${avgLocalTime.toFixed(2)}ms, min ${minLocalTime.toFixed(2)}ms, max ${maxLocalTime.toFixed(2)}ms`);
      
      expect(avgLocalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
      expect(maxLocalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
    });

    it('should provide performance insights for optimization', async () => {
      const performanceTestSuite = [
        { type: 'short', query: 'VSAM' },
        { type: 'medium', query: 'error handling best practices' },
        { type: 'long', query: 'comprehensive troubleshooting guide for mainframe systems' },
        { type: 'technical', query: 'S0C7 COBOL COMP-3 data exception analysis' },
        { type: 'fuzzy', query: 'erro handeling in bacht procesing' }
      ];
      
      for (const { type, query } of performanceTestSuite) {
        const iterations = 5;
        const timings: number[] = [];
        
        for (let i = 0; i < iterations; i++) {
          const startTime = performance.now();
          const result = await hybridSearchService.search(query, undefined, { enableAI: false });
          const endTime = performance.now();
          
          timings.push(endTime - startTime);
        }
        
        const average = timings.reduce((a, b) => a + b, 0) / timings.length;
        const min = Math.min(...timings);
        const max = Math.max(...timings);
        
        console.log(`${type} query performance: avg ${average.toFixed(2)}ms, range ${min.toFixed(2)}-${max.toFixed(2)}ms`);
        
        expect(average).toBeLessThan(PERFORMANCE_THRESHOLDS.LOCAL_SEARCH_MAX_TIME);
      }
    });
  });

  describe('Performance Regression Prevention', () => {
    it('should maintain baseline performance benchmarks', async () => {
      // Baseline performance tests that should not regress
      const baselineTests = [
        { name: 'Simple term search', query: 'error', maxTime: 100 },
        { name: 'Category filter', query: 'processing', category: 'Batch' as KBCategory, maxTime: 150 },
        { name: 'Multi-term search', query: 'VSAM status error', maxTime: 200 },
        { name: 'Fuzzy search', query: 'databse erro', maxTime: 250 }
      ];
      
      for (const test of baselineTests) {
        const startTime = performance.now();
        
        const result = await hybridSearchService.search(
          test.query, 
          test.category, 
          { enableAI: false }
        );
        
        const endTime = performance.now();
        const searchTime = endTime - startTime;
        
        expect(searchTime).toBeLessThan(test.maxTime);
        expect(result.performance.localCompleted).toBe(true);
        
        console.log(`Baseline test "${test.name}": ${searchTime.toFixed(2)}ms (limit: ${test.maxTime}ms)`);
      }
    });

    it('should validate memory usage stays within bounds', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform intensive search operations
      const intensiveQueries = Array(50).fill(0).map((_, i) => `intensive test query ${i}`);
      
      for (const query of intensiveQueries) {
        await hybridSearchService.search(query, undefined, { enableAI: false });
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory usage increased by ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});
