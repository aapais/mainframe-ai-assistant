/**
 * SearchService Performance Tests
 * Load testing, stress testing, spike testing, and endurance testing
 * Validates <1s response time requirement
 */

import { SearchService } from '../SearchService';
import { KBEntry, SearchOptions } from '../../types/services';
import { performance } from 'perf_hooks';

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  SEARCH_TIME_MS: 1000,         // <1s requirement
  LOAD_TEST_TIME_MS: 1500,      // Allow extra time under load
  MEMORY_THRESHOLD_MB: 100,     // Memory usage threshold
  THROUGHPUT_MIN_QPS: 10        // Minimum queries per second
};

describe('SearchService Performance Tests', () => {
  let searchService: SearchService;
  let testEntries: KBEntry[];
  let largeDataset: KBEntry[];

  beforeAll(async () => {
    searchService = new SearchService();
    testEntries = generateTestEntries(100);   // Standard dataset
    largeDataset = generateTestEntries(1000); // Large dataset for stress testing
  });

  function generateTestEntries(count: number): KBEntry[] {
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'System', 'Other'];
    const errorCodes = ['S0C7', 'S0C4', 'S013', 'U0778', 'IEF212I', 'WER027A', 'EDC8128I'];
    const components = ['COBOL', 'JCL', 'VSAM', 'DB2', 'CICS', 'IMS', 'Dataset', 'File'];
    const operations = ['Read', 'Write', 'Update', 'Delete', 'Open', 'Close', 'Allocate', 'Process'];
    
    const entries: KBEntry[] = [];
    
    for (let i = 0; i < count; i++) {
      const category = categories[i % categories.length];
      const errorCode = errorCodes[i % errorCodes.length];
      const component = components[i % components.length];
      const operation = operations[i % operations.length];
      
      entries.push({
        id: `perf-test-${i}`,
        title: `${category} ${errorCode} Error in ${component} ${operation}`,
        problem: `Performance test entry ${i}: ${component} ${operation} fails with ${errorCode} error. This is a generated entry for performance testing with detailed problem description that includes common mainframe error scenarios and troubleshooting information.`,
        solution: `Performance test solution ${i}: 1. Check ${component} configuration\n2. Verify ${operation} permissions\n3. Review ${errorCode} documentation\n4. Contact system administrator if issue persists\n5. Monitor system resources\n6. Check log files for additional details`,
        category: category as any,
        tags: [
          `perf-test-${i}`,
          errorCode.toLowerCase(),
          component.toLowerCase(),
          operation.toLowerCase(),
          'performance',
          'test',
          'generated'
        ],
        created_at: new Date(Date.now() - (i * 86400000)), // Spread over time
        updated_at: new Date(Date.now() - (i * 86400000)),
        created_by: 'performance-test',
        usage_count: Math.floor(Math.random() * 100),
        success_count: Math.floor(Math.random() * 80),
        failure_count: Math.floor(Math.random() * 20),
        version: 1
      });
    }
    
    return entries;
  }

  function measureMemoryUsage(): number {
    if (process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }
    return 0;
  }

  describe('Response Time Tests (<1s requirement)', () => {
    test('should complete search within 1 second for single query', async () => {
      const startTime = performance.now();
      
      const results = await searchService.search('error abend S0C7', testEntries);
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should complete search within 1 second for complex query', async () => {
      const complexQuery = 'VSAM file not found status code 35 dataset allocation error JCL problem';
      
      const startTime = performance.now();
      const results = await searchService.search(complexQuery, testEntries);
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
      expect(results).toBeDefined();
    });

    test('should complete search within 1 second with large dataset', async () => {
      const startTime = performance.now();
      
      const results = await searchService.search('performance test', largeDataset);
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should complete search with all options within 1 second', async () => {
      const options: SearchOptions = {
        limit: 50,
        category: 'VSAM',
        tags: ['error'],
        sortBy: 'usage',
        includeHighlights: true,
        threshold: 0.1
      };
      
      const startTime = performance.now();
      const results = await searchService.search('error', testEntries, options);
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
      expect(results).toBeDefined();
    });

    test('should complete suggestions within 1 second', async () => {
      // Build search history first
      for (let i = 0; i < 10; i++) {
        await searchService.search(`test query ${i}`, testEntries);
      }
      
      const startTime = performance.now();
      const suggestions = await searchService.suggest('test');
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
      expect(suggestions).toBeDefined();
    });
  });

  describe('Load Testing', () => {
    test('should handle concurrent searches efficiently', async () => {
      const concurrentSearches = 10;
      const queries = [
        'error abend',
        'VSAM status',
        'JCL dataset',
        'DB2 resource',
        'CICS transaction',
        'file not found',
        'data exception',
        'allocation error',
        'program check',
        'system abend'
      ];
      
      const startTime = performance.now();
      
      const promises = Array.from({ length: concurrentSearches }, (_, i) => 
        searchService.search(queries[i % queries.length], testEntries)
      );
      
      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;
      
      // Average time per search should still be under threshold
      const avgTimePerSearch = duration / concurrentSearches;
      expect(avgTimePerSearch).toBeLessThan(PERFORMANCE_THRESHOLDS.LOAD_TEST_TIME_MS);
      
      // All searches should return results
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBeTruthy();
      });
    });

    test('should maintain performance under sustained load', async () => {
      const sustainedQueries = 50;
      const queries = ['error', 'abend', 'status', 'exception', 'not found'];
      const responseTimes: number[] = [];
      
      for (let i = 0; i < sustainedQueries; i++) {
        const query = queries[i % queries.length];
        const startTime = performance.now();
        
        await searchService.search(query, testEntries);
        
        const duration = performance.now() - startTime;
        responseTimes.push(duration);
      }
      
      // Calculate statistics
      const avgResponseTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
      
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
      expect(maxResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOAD_TEST_TIME_MS);
      expect(p95ResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
    });

    test('should handle rapid successive searches', async () => {
      const rapidSearches = 20;
      const startTime = performance.now();
      
      for (let i = 0; i < rapidSearches; i++) {
        await searchService.search(`rapid test ${i}`, testEntries);
      }
      
      const totalDuration = performance.now() - startTime;
      const avgTimePerSearch = totalDuration / rapidSearches;
      
      expect(avgTimePerSearch).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
    });
  });

  describe('Stress Testing', () => {
    test('should handle maximum dataset size efficiently', async () => {
      const maxDataset = generateTestEntries(2000); // Stress test with 2000 entries
      
      const startTime = performance.now();
      const results = await searchService.search('stress test query', maxDataset);
      const duration = performance.now() - startTime;
      
      // Allow slightly more time for very large datasets
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LOAD_TEST_TIME_MS);
      expect(results).toBeDefined();
    });

    test('should handle complex search options with large dataset', async () => {
      const complexOptions: SearchOptions = {
        limit: 100,
        includeHighlights: true,
        sortBy: 'usage',
        threshold: 0.05
      };
      
      const startTime = performance.now();
      const results = await searchService.search('complex stress test', largeDataset, complexOptions);
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LOAD_TEST_TIME_MS);
      expect(results).toBeDefined();
    });

    test('should handle memory pressure gracefully', async () => {
      const initialMemory = measureMemoryUsage();
      
      // Perform many searches to stress memory
      for (let i = 0; i < 100; i++) {
        await searchService.search(`memory stress ${i}`, largeDataset);
      }
      
      const finalMemory = measureMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_THRESHOLD_MB);
    });

    test('should maintain performance with very long queries', async () => {
      const longQuery = 'very long search query with many terms and conditions that tests the performance of the search algorithm when processing complex and detailed search requests with multiple keywords and phrases that should still complete within acceptable time limits despite the increased complexity and processing requirements';
      
      const startTime = performance.now();
      const results = await searchService.search(longQuery, testEntries);
      const duration = performance.now() - startTime;
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
      expect(results).toBeDefined();
    });
  });

  describe('Spike Testing', () => {
    test('should handle sudden load spikes', async () => {
      // Normal load baseline
      const baselineStart = performance.now();
      await searchService.search('baseline test', testEntries);
      const baselineDuration = performance.now() - baselineStart;
      
      // Sudden spike - 50 concurrent searches
      const spikePromises = Array.from({ length: 50 }, (_, i) => 
        searchService.search(`spike test ${i}`, testEntries)
      );
      
      const spikeStart = performance.now();
      const spikeResults = await Promise.all(spikePromises);
      const spikeDuration = performance.now() - spikeStart;
      
      // Average response time during spike should be reasonable
      const avgSpikeTime = spikeDuration / 50;
      expect(avgSpikeTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOAD_TEST_TIME_MS);
      
      // All spike searches should complete successfully
      spikeResults.forEach(result => {
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBeTruthy();
      });
      
      // Post-spike performance should recover
      const recoveryStart = performance.now();
      await searchService.search('recovery test', testEntries);
      const recoveryDuration = performance.now() - recoveryStart;
      
      expect(recoveryDuration).toBeLessThan(baselineDuration * 2); // Should recover
    });

    test('should handle mixed query complexity spikes', async () => {
      const simpleQueries = Array.from({ length: 20 }, (_, i) => `simple ${i}`);
      const complexQueries = Array.from({ length: 10 }, (_, i) => 
        `complex search query with multiple terms and conditions ${i} error abend status`
      );
      
      const allQueries = [...simpleQueries, ...complexQueries];
      const promises = allQueries.map(query => {
        const startTime = performance.now();
        return searchService.search(query, testEntries).then(result => ({
          result,
          duration: performance.now() - startTime
        }));
      });
      
      const results = await Promise.all(promises);
      
      // All queries should complete within acceptable time
      results.forEach(({ result, duration }) => {
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LOAD_TEST_TIME_MS);
        expect(result).toBeDefined();
      });
    });
  });

  describe('Endurance Testing', () => {
    test('should maintain performance over extended period', async () => {
      const enduranceQueries = 200;
      const responseTimes: number[] = [];
      const queries = ['endurance', 'test', 'long', 'running', 'performance'];
      
      for (let i = 0; i < enduranceQueries; i++) {
        const query = `${queries[i % queries.length]} ${i}`;
        const startTime = performance.now();
        
        await searchService.search(query, testEntries);
        
        const duration = performance.now() - startTime;
        responseTimes.push(duration);
        
        // Small delay to simulate real usage pattern
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Analyze performance stability
      const firstQuarter = responseTimes.slice(0, Math.floor(enduranceQueries / 4));
      const lastQuarter = responseTimes.slice(-Math.floor(enduranceQueries / 4));
      
      const firstQuarterAvg = firstQuarter.reduce((a, b) => a + b) / firstQuarter.length;
      const lastQuarterAvg = lastQuarter.reduce((a, b) => a + b) / lastQuarter.length;
      
      // Performance should not degrade significantly over time
      expect(lastQuarterAvg).toBeLessThan(firstQuarterAvg * 1.5); // Max 50% degradation
      expect(lastQuarterAvg).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
    });

    test('should not experience memory leaks during extended use', async () => {
      const initialMemory = measureMemoryUsage();
      
      // Simulate extended usage
      for (let i = 0; i < 500; i++) {
        await searchService.search(`memory leak test ${i}`, testEntries);
        
        // Check memory periodically
        if (i % 100 === 0) {
          const currentMemory = measureMemoryUsage();
          const memoryIncrease = currentMemory - initialMemory;
          
          // Memory should not continuously increase
          expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_THRESHOLD_MB);
        }
      }
      
      // Final memory check
      const finalMemory = measureMemoryUsage();
      const totalMemoryIncrease = finalMemory - initialMemory;
      
      expect(totalMemoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_THRESHOLD_MB);
    });
  });

  describe('Throughput Testing', () => {
    test('should achieve minimum throughput requirements', async () => {
      const testDuration = 5000; // 5 seconds
      const startTime = performance.now();
      let queryCount = 0;
      
      const runQueries = async () => {
        while (performance.now() - startTime < testDuration) {
          await searchService.search(`throughput test ${queryCount}`, testEntries);
          queryCount++;
        }
      };
      
      await runQueries();
      
      const actualDuration = (performance.now() - startTime) / 1000; // Convert to seconds
      const queriesPerSecond = queryCount / actualDuration;
      
      expect(queriesPerSecond).toBeGreaterThan(PERFORMANCE_THRESHOLDS.THROUGHPUT_MIN_QPS);
    });

    test('should handle concurrent users efficiently', async () => {
      const concurrentUsers = 5;
      const queriesPerUser = 10;
      const userQueries = Array.from({ length: concurrentUsers }, (_, userIndex) =>
        Array.from({ length: queriesPerUser }, (_, queryIndex) => 
          `user${userIndex} query${queryIndex}`
        )
      );
      
      const startTime = performance.now();
      
      const userPromises = userQueries.map(queries =>
        Promise.all(queries.map(query => searchService.search(query, testEntries)))
      );
      
      const results = await Promise.all(userPromises);
      const duration = performance.now() - startTime;
      
      const totalQueries = concurrentUsers * queriesPerUser;
      const avgTimePerQuery = duration / totalQueries;
      
      expect(avgTimePerQuery).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
      
      // All users should get results
      results.forEach(userResults => {
        userResults.forEach(queryResult => {
          expect(queryResult).toBeDefined();
          expect(Array.isArray(queryResult)).toBeTruthy();
        });
      });
    });
  });

  describe('Edge Case Performance Tests', () => {
    test('should handle empty results efficiently', async () => {
      const startTime = performance.now();
      
      const results = await searchService.search('nonexistent query xyz123', testEntries);
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
      expect(results).toHaveLength(0);
    });

    test('should handle malformed queries efficiently', async () => {
      const malformedQueries = [
        '!!!@@@###$$$',
        '    ',
        '????????',
        'a'.repeat(1000), // Very long query
        '1234567890',
        '//////\\\\\\\\',
        '"""""""""""'
      ];
      
      for (const query of malformedQueries) {
        const startTime = performance.now();
        
        const results = await searchService.search(query, testEntries);
        
        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
        expect(results).toBeDefined();
      }
    });

    test('should handle edge case search options efficiently', async () => {
      const edgeCaseOptions: SearchOptions[] = [
        { limit: 0 },
        { limit: 10000 },
        { threshold: 0 },
        { threshold: 1 },
        { tags: [] },
        { tags: Array.from({ length: 100 }, (_, i) => `tag${i}`) }
      ];
      
      for (const options of edgeCaseOptions) {
        const startTime = performance.now();
        
        const results = await searchService.search('edge case test', testEntries, options);
        
        const duration = performance.now() - startTime;
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME_MS);
        expect(results).toBeDefined();
      }
    });
  });
});