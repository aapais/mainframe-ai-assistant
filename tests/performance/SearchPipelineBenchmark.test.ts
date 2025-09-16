/**
 * Complete Search Pipeline Performance Benchmark Tests
 *
 * Tests the entire search flow with comprehensive performance validation,
 * bottleneck identification, and optimization recommendations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'jest';
import { performance } from 'perf_hooks';
import { SearchService } from '../../src/services/SearchService';
import { SearchOptimizer } from '../../src/services/SearchOptimizer';
import { SearchMetrics } from '../../src/services/SearchMetrics';
import { SearchPerformanceDashboard } from '../../src/monitoring/SearchPerformanceDashboard';

// Performance targets
const PERFORMANCE_TARGETS = {
  SEARCH_RESPONSE_P95: 1000,    // <1s P95
  CACHE_HIT_RATE: 0.90,         // >90%
  MEMORY_LIMIT: 256 * 1024 * 1024, // 256MB
  AUTOCOMPLETE_TIME: 50,        // <50ms
  UI_RENDER_TIME: 200,          // <200ms
  ERROR_RATE: 0.05,             // <5%
  THROUGHPUT_MIN: 10            // >10 req/sec
};

interface BenchmarkResult {
  testName: string;
  metrics: {
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    throughput: number;
    errorRate: number;
    memoryUsage: number;
    cacheHitRate: number;
  };
  passed: boolean;
  bottlenecks: string[];
  recommendations: string[];
}

class SearchPipelineBenchmark {
  private searchService: SearchService;
  private optimizer: SearchOptimizer;
  private metrics: SearchMetrics;
  private dashboard: SearchPerformanceDashboard;
  private testKBEntries: any[];
  private results: BenchmarkResult[] = [];

  constructor() {
    this.searchService = new SearchService({
      apiKey: 'test-key',
      model: 'gemini-pro',
      temperature: 0.3
    });

    this.optimizer = new SearchOptimizer(this.searchService);
    this.metrics = new SearchMetrics();
    this.dashboard = new SearchPerformanceDashboard(this.searchService);

    this.testKBEntries = this.generateTestData();
  }

  async setup(): Promise<void> {
    console.log('🚀 Setting up Search Pipeline Benchmark...');

    // Build search index
    await this.searchService.buildIndex(this.testKBEntries);

    // Start monitoring
    this.dashboard.startMonitoring();

    console.log(`✅ Test setup complete with ${this.testKBEntries.length} KB entries`);
  }

  async cleanup(): Promise<void> {
    this.dashboard.stopMonitoring();
    console.log('🧹 Benchmark cleanup complete');
  }

  /**
   * Run complete performance benchmark suite
   */
  async runBenchmarkSuite(): Promise<BenchmarkResult[]> {
    console.log('\n📊 Starting Search Pipeline Performance Benchmark Suite\n');

    // Core performance tests
    await this.benchmarkBasicSearch();
    await this.benchmarkSearchWithFilters();
    await this.benchmarkAISearchPerformance();
    await this.benchmarkCachePerformance();
    await this.benchmarkConcurrentUsers();
    await this.benchmarkMemoryUsage();
    await this.benchmarkAutocomplete();
    await this.benchmarkErrorHandling();
    await this.benchmarkThroughput();

    // Generate summary report
    this.generateSummaryReport();

    return this.results;
  }

  /**
   * Test basic search performance
   */
  private async benchmarkBasicSearch(): Promise<void> {
    console.log('🔍 Benchmarking basic search performance...');

    const testQueries = [
      'vsam status 35',
      's0c7 data exception',
      'jcl error dataset not found',
      'db2 sqlcode -904',
      'cobol abend program check',
      'cics transaction',
      'batch job failure',
      'mainframe error',
      'system abend',
      'file not found'
    ];

    const responseTimes: number[] = [];
    const errors: number[] = [];
    const memoryReadings: number[] = [];

    for (let i = 0; i < 100; i++) {
      const query = testQueries[i % testQueries.length];
      const startTime = performance.now();
      const memoryBefore = this.getMemoryUsage();

      try {
        const results = await this.searchService.search(query, this.testKBEntries, {
          limit: 50
        });

        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);

        expect(results).toBeDefined();
        expect(results.length).toBeGreaterThanOrEqual(0);

        // Record metrics
        this.dashboard.recordSearchMetric(
          query,
          responseTime,
          results.length,
          false // Assume cache miss for first run
        );

      } catch (error) {
        errors.push(1);
        console.error(`Search failed for "${query}":`, error.message);
      }

      const memoryAfter = this.getMemoryUsage();
      memoryReadings.push(memoryAfter - memoryBefore);

      // Small delay between requests
      if (i % 10 === 9) {
        await this.sleep(50);
      }
    }

    const result = this.analyzeResults('Basic Search', responseTimes, errors, memoryReadings);
    this.results.push(result);

    console.log(`   Average: ${result.metrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`   P95: ${result.metrics.p95ResponseTime.toFixed(2)}ms`);
    console.log(`   Error Rate: ${(result.metrics.errorRate * 100).toFixed(2)}%`);
    console.log(`   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * Test search with various filters
   */
  private async benchmarkSearchWithFilters(): Promise<void> {
    console.log('🎯 Benchmarking filtered search performance...');

    const testCases = [
      { query: 'error', category: 'VSAM' },
      { query: 'status', category: 'JCL' },
      { query: 'abend', category: 'Batch' },
      { query: 'sql', category: 'DB2' },
      { query: 'transaction', tags: ['cics', 'mainframe'] },
      { query: 'dataset', tags: ['allocation', 'catalog'] }
    ];

    const responseTimes: number[] = [];
    const errors: number[] = [];

    for (let i = 0; i < 60; i++) {
      const testCase = testCases[i % testCases.length];
      const startTime = performance.now();

      try {
        const results = await this.searchService.search(testCase.query, this.testKBEntries, {
          category: testCase.category,
          tags: testCase.tags,
          limit: 50
        });

        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);

        // Verify filtering worked
        if (testCase.category) {
          results.forEach(result => {
            expect(result.entry.category).toBe(testCase.category);
          });
        }

      } catch (error) {
        errors.push(1);
      }
    }

    const result = this.analyzeResults('Filtered Search', responseTimes, errors);
    this.results.push(result);

    console.log(`   Average: ${result.metrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`   P95: ${result.metrics.p95ResponseTime.toFixed(2)}ms`);
    console.log(`   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * Test AI search performance with fallback
   */
  private async benchmarkAISearchPerformance(): Promise<void> {
    console.log('🤖 Benchmarking AI search performance...');

    const queries = [
      'How to fix data exception in COBOL',
      'VSAM file not accessible error',
      'Database connection timeout issue',
      'JCL syntax error troubleshooting',
      'Mainframe batch job optimization'
    ];

    const responseTimes: number[] = [];
    const errors: number[] = [];
    const fallbackCount = { count: 0 };

    for (let i = 0; i < 25; i++) {
      const query = queries[i % queries.length];
      const startTime = performance.now();

      try {
        const results = await this.searchService.searchWithAI(query, this.testKBEntries, {
          useAI: true,
          limit: 20
        });

        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);

        // Check if results indicate fallback was used
        const hasFallbackResults = results.some(result =>
          result.metadata?.fallback === true
        );

        if (hasFallbackResults) {
          fallbackCount.count++;
        }

      } catch (error) {
        errors.push(1);
        console.warn(`AI search failed for "${query}", testing fallback...`);

        // Test fallback performance
        try {
          const fallbackStart = performance.now();
          await this.searchService.search(query, this.testKBEntries, { useAI: false });
          const fallbackTime = performance.now() - fallbackStart;

          responseTimes.push(fallbackTime);
          fallbackCount.count++;
        } catch (fallbackError) {
          // Complete failure
        }
      }
    }

    const result = this.analyzeResults('AI Search', responseTimes, errors);
    result.metrics.cacheHitRate = (fallbackCount.count / 25); // Repurpose for fallback rate
    this.results.push(result);

    console.log(`   Average: ${result.metrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`   P95: ${result.metrics.p95ResponseTime.toFixed(2)}ms`);
    console.log(`   Fallback Rate: ${(fallbackCount.count / 25 * 100).toFixed(1)}%`);
    console.log(`   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * Test cache performance and hit rates
   */
  private async benchmarkCachePerformance(): Promise<void> {
    console.log('💾 Benchmarking cache performance...');

    const repeatedQueries = [
      'vsam status 35',
      's0c7 error',
      'jcl dataset',
      'db2 connection',
      'cobol program'
    ];

    let cacheHits = 0;
    const firstPassTimes: number[] = [];
    const secondPassTimes: number[] = [];

    // First pass - should populate cache
    for (const query of repeatedQueries) {
      const startTime = performance.now();
      await this.searchService.search(query, this.testKBEntries);
      firstPassTimes.push(performance.now() - startTime);
    }

    await this.sleep(100); // Brief pause

    // Second pass - should hit cache
    for (const query of repeatedQueries) {
      const startTime = performance.now();
      await this.searchService.search(query, this.testKBEntries);
      const responseTime = performance.now() - startTime;
      secondPassTimes.push(responseTime);

      // Cache hit if significantly faster
      if (responseTime < firstPassTimes[secondPassTimes.length - 1] * 0.8) {
        cacheHits++;
      }
    }

    const cacheHitRate = cacheHits / repeatedQueries.length;
    const avgCacheTime = secondPassTimes.reduce((a, b) => a + b, 0) / secondPassTimes.length;

    const result = this.analyzeResults('Cache Performance', secondPassTimes, []);
    result.metrics.cacheHitRate = cacheHitRate;
    this.results.push(result);

    console.log(`   Cache Hit Rate: ${(cacheHitRate * 100).toFixed(1)}%`);
    console.log(`   Avg Cache Response: ${avgCacheTime.toFixed(2)}ms`);
    console.log(`   Status: ${cacheHitRate >= PERFORMANCE_TARGETS.CACHE_HIT_RATE ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * Test concurrent user performance
   */
  private async benchmarkConcurrentUsers(): Promise<void> {
    console.log('👥 Benchmarking concurrent user performance...');

    const userCount = 20; // Reduced for test environment
    const searchesPerUser = 3;
    const queries = [
      'error handling',
      'system failure',
      'data processing',
      'file management',
      'database query',
      'network issue',
      'security error',
      'performance problem'
    ];

    const allTimes: number[] = [];
    const errors: number[] = [];

    const promises = Array.from({ length: userCount }, async (_, userIndex) => {
      const userTimes: number[] = [];

      for (let i = 0; i < searchesPerUser; i++) {
        const query = queries[(userIndex * searchesPerUser + i) % queries.length];
        const startTime = performance.now();

        try {
          await this.searchService.search(query, this.testKBEntries);
          const responseTime = performance.now() - startTime;
          userTimes.push(responseTime);
        } catch (error) {
          errors.push(1);
        }

        // Random delay between user requests
        await this.sleep(Math.random() * 100);
      }

      return userTimes;
    });

    const results = await Promise.all(promises);
    results.forEach(userTimes => allTimes.push(...userTimes));

    const result = this.analyzeResults('Concurrent Users', allTimes, errors);
    this.results.push(result);

    console.log(`   ${userCount} concurrent users, ${userCount * searchesPerUser} total searches`);
    console.log(`   Average: ${result.metrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`   P95: ${result.metrics.p95ResponseTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${result.metrics.throughput.toFixed(1)} req/sec`);
    console.log(`   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * Test memory usage and leak detection
   */
  private async benchmarkMemoryUsage(): Promise<void> {
    console.log('🧠 Benchmarking memory usage...');

    const initialMemory = this.getMemoryUsage();
    const memoryReadings: number[] = [];
    const queries = ['test memory usage', 'memory leak detection', 'performance monitoring'];

    // Perform many searches to test memory usage
    for (let i = 0; i < 50; i++) {
      const query = queries[i % queries.length];

      await this.searchService.search(query, this.testKBEntries);

      if (i % 10 === 9) {
        const currentMemory = this.getMemoryUsage();
        memoryReadings.push(currentMemory - initialMemory);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }

    const finalMemory = this.getMemoryUsage();
    const memoryIncrease = finalMemory - initialMemory;
    const maxMemory = Math.max(...memoryReadings);

    const result: BenchmarkResult = {
      testName: 'Memory Usage',
      metrics: {
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        throughput: 0,
        errorRate: 0,
        memoryUsage: memoryIncrease,
        cacheHitRate: 0
      },
      passed: memoryIncrease < PERFORMANCE_TARGETS.MEMORY_LIMIT,
      bottlenecks: memoryIncrease > PERFORMANCE_TARGETS.MEMORY_LIMIT * 0.8 ? ['High memory usage'] : [],
      recommendations: memoryIncrease > PERFORMANCE_TARGETS.MEMORY_LIMIT * 0.6 ? ['Optimize memory usage', 'Implement cleanup'] : []
    };

    this.results.push(result);

    console.log(`   Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Max Memory: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * Test autocomplete performance
   */
  private async benchmarkAutocomplete(): Promise<void> {
    console.log('⚡ Benchmarking autocomplete performance...');

    const prefixes = ['vs', 'jc', 's0', 'db', 'co', 'er', 'sy', 'ma', 'da', 'fi'];
    const responseTimes: number[] = [];

    for (let i = 0; i < 50; i++) {
      const prefix = prefixes[i % prefixes.length];
      const startTime = performance.now();

      try {
        const suggestions = await this.searchService.suggest(prefix, 10);
        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);

        expect(suggestions).toBeDefined();
        expect(Array.isArray(suggestions)).toBe(true);

      } catch (error) {
        console.warn(`Autocomplete failed for "${prefix}":`, error.message);
      }
    }

    const result = this.analyzeResults('Autocomplete', responseTimes, []);
    result.passed = result.metrics.p95ResponseTime < PERFORMANCE_TARGETS.AUTOCOMPLETE_TIME;
    this.results.push(result);

    console.log(`   Average: ${result.metrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`   P95: ${result.metrics.p95ResponseTime.toFixed(2)}ms`);
    console.log(`   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * Test error handling performance
   */
  private async benchmarkErrorHandling(): Promise<void> {
    console.log('⚠️ Benchmarking error handling performance...');

    const errorScenarios = [
      { query: '', description: 'Empty query' },
      { query: 'a', description: 'Too short query' },
      { query: 'x'.repeat(1000), description: 'Very long query' },
      { query: null as any, description: 'Null query' },
      { query: undefined as any, description: 'Undefined query' }
    ];

    const responseTimes: number[] = [];
    let errors = 0;

    for (let i = 0; i < 25; i++) {
      const scenario = errorScenarios[i % errorScenarios.length];
      const startTime = performance.now();

      try {
        await this.searchService.search(scenario.query, this.testKBEntries);
        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);
      } catch (error) {
        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);
        errors++;

        // Errors should still be handled quickly
        expect(responseTime).toBeLessThan(500);
      }
    }

    const errorRate = errors / 25;
    const result = this.analyzeResults('Error Handling', responseTimes, []);
    result.metrics.errorRate = errorRate;
    this.results.push(result);

    console.log(`   Error Rate: ${(errorRate * 100).toFixed(1)}%`);
    console.log(`   Avg Error Response: ${result.metrics.avgResponseTime.toFixed(2)}ms`);
    console.log(`   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * Test overall system throughput
   */
  private async benchmarkThroughput(): Promise<void> {
    console.log('🚀 Benchmarking system throughput...');

    const queries = ['throughput', 'performance', 'benchmark', 'test', 'system'];
    const duration = 10000; // 10 seconds
    const startTime = performance.now();
    let requestCount = 0;
    const responseTimes: number[] = [];

    while (performance.now() - startTime < duration) {
      const query = queries[requestCount % queries.length];
      const requestStart = performance.now();

      try {
        await this.searchService.search(query, this.testKBEntries);
        responseTimes.push(performance.now() - requestStart);
        requestCount++;
      } catch (error) {
        // Continue testing
      }

      // Small delay to prevent overwhelming
      await this.sleep(10);
    }

    const actualDuration = (performance.now() - startTime) / 1000;
    const throughput = requestCount / actualDuration;

    const result = this.analyzeResults('Throughput', responseTimes, []);
    result.metrics.throughput = throughput;
    result.passed = throughput >= PERFORMANCE_TARGETS.THROUGHPUT_MIN;
    this.results.push(result);

    console.log(`   Requests: ${requestCount} in ${actualDuration.toFixed(1)}s`);
    console.log(`   Throughput: ${throughput.toFixed(1)} req/sec`);
    console.log(`   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  /**
   * Generate comprehensive summary report
   */
  private generateSummaryReport(): void {
    console.log('\n📋 Performance Benchmark Summary Report\n');
    console.log('=' .repeat(60));

    const passedTests = this.results.filter(r => r.passed).length;
    const totalTests = this.results.length;
    const overallPass = passedTests === totalTests;

    console.log(`Overall Result: ${overallPass ? '✅ PASS' : '❌ FAIL'} (${passedTests}/${totalTests} tests passed)`);
    console.log('=' .repeat(60));

    this.results.forEach(result => {
      console.log(`\n📊 ${result.testName}:`);
      console.log(`   Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);

      if (result.metrics.avgResponseTime > 0) {
        console.log(`   Avg Response: ${result.metrics.avgResponseTime.toFixed(2)}ms`);
        console.log(`   P95 Response: ${result.metrics.p95ResponseTime.toFixed(2)}ms`);
      }

      if (result.metrics.throughput > 0) {
        console.log(`   Throughput: ${result.metrics.throughput.toFixed(1)} req/sec`);
      }

      if (result.metrics.errorRate > 0) {
        console.log(`   Error Rate: ${(result.metrics.errorRate * 100).toFixed(2)}%`);
      }

      if (result.metrics.cacheHitRate > 0) {
        console.log(`   Cache Hit Rate: ${(result.metrics.cacheHitRate * 100).toFixed(1)}%`);
      }

      if (result.metrics.memoryUsage > 0) {
        console.log(`   Memory Usage: ${(result.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      }

      if (result.bottlenecks.length > 0) {
        console.log(`   ⚠️ Bottlenecks: ${result.bottlenecks.join(', ')}`);
      }

      if (result.recommendations.length > 0) {
        console.log(`   💡 Recommendations: ${result.recommendations.join(', ')}`);
      }
    });

    console.log('\n' + '=' .repeat(60));
    console.log('🎯 Performance Targets Validation:');

    const avgP95 = this.results
      .filter(r => r.metrics.p95ResponseTime > 0)
      .reduce((sum, r) => sum + r.metrics.p95ResponseTime, 0) /
      this.results.filter(r => r.metrics.p95ResponseTime > 0).length;

    console.log(`   Search P95 Response Time: ${avgP95?.toFixed(2) || 'N/A'}ms (target: <${PERFORMANCE_TARGETS.SEARCH_RESPONSE_P95}ms)`);

    const cacheResult = this.results.find(r => r.testName === 'Cache Performance');
    if (cacheResult) {
      console.log(`   Cache Hit Rate: ${(cacheResult.metrics.cacheHitRate * 100).toFixed(1)}% (target: >${PERFORMANCE_TARGETS.CACHE_HIT_RATE * 100}%)`);
    }

    const memoryResult = this.results.find(r => r.testName === 'Memory Usage');
    if (memoryResult) {
      console.log(`   Memory Usage: ${(memoryResult.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB (target: <${PERFORMANCE_TARGETS.MEMORY_LIMIT / 1024 / 1024}MB)`);
    }

    const throughputResult = this.results.find(r => r.testName === 'Throughput');
    if (throughputResult) {
      console.log(`   Throughput: ${throughputResult.metrics.throughput.toFixed(1)} req/sec (target: >${PERFORMANCE_TARGETS.THROUGHPUT_MIN} req/sec)`);
    }

    console.log('\n✨ Benchmark Suite Complete!\n');
  }

  // Helper methods

  private analyzeResults(testName: string, responseTimes: number[], errors: number[], memoryReadings: number[] = []): BenchmarkResult {
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const totalRequests = responseTimes.length;

    const metrics = {
      avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / totalRequests || 0,
      p50ResponseTime: sortedTimes[Math.floor(totalRequests * 0.5)] || 0,
      p95ResponseTime: sortedTimes[Math.floor(totalRequests * 0.95)] || 0,
      p99ResponseTime: sortedTimes[Math.floor(totalRequests * 0.99)] || 0,
      minResponseTime: Math.min(...responseTimes) || 0,
      maxResponseTime: Math.max(...responseTimes) || 0,
      throughput: totalRequests / (Math.max(...responseTimes, 1000) / 1000) || 0,
      errorRate: errors.length / Math.max(totalRequests, 1),
      memoryUsage: Math.max(...memoryReadings, 0),
      cacheHitRate: 0
    };

    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    // Identify bottlenecks
    if (metrics.p95ResponseTime > PERFORMANCE_TARGETS.SEARCH_RESPONSE_P95 * 0.8) {
      bottlenecks.push('High response time');
      recommendations.push('Optimize search algorithms');
    }

    if (metrics.errorRate > PERFORMANCE_TARGETS.ERROR_RATE * 0.5) {
      bottlenecks.push('High error rate');
      recommendations.push('Improve error handling');
    }

    const passed =
      metrics.p95ResponseTime < PERFORMANCE_TARGETS.SEARCH_RESPONSE_P95 &&
      metrics.errorRate < PERFORMANCE_TARGETS.ERROR_RATE;

    return {
      testName,
      metrics,
      passed,
      bottlenecks,
      recommendations
    };
  }

  private generateTestData(): any[] {
    const categories = ['VSAM', 'JCL', 'DB2', 'Batch', 'Functional'];
    const commonTerms = [
      'error', 'status', 'abend', 'failure', 'exception', 'timeout', 'connection',
      'dataset', 'file', 'database', 'program', 'job', 'transaction', 'system'
    ];

    return Array.from({ length: 1000 }, (_, index) => ({
      id: `test-${index}`,
      title: `Test Entry ${index}: ${commonTerms[index % commonTerms.length]} in ${categories[index % categories.length]}`,
      problem: `This is a test problem description for entry ${index} containing ${commonTerms[index % commonTerms.length]} issues.`,
      solution: `This is the solution for test problem ${index}. Follow these steps to resolve the issue.`,
      category: categories[index % categories.length],
      tags: [commonTerms[index % commonTerms.length], categories[index % categories.length].toLowerCase()],
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      updated_at: new Date(),
      usage_count: Math.floor(Math.random() * 100),
      success_count: Math.floor(Math.random() * 50),
      failure_count: Math.floor(Math.random() * 10)
    }));
  }

  private getMemoryUsage(): number {
    if (process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Jest test suite
describe('Search Pipeline Performance Benchmark', () => {
  let benchmark: SearchPipelineBenchmark;

  beforeAll(async () => {
    benchmark = new SearchPipelineBenchmark();
    await benchmark.setup();
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    await benchmark.cleanup();
  });

  it('should complete full performance benchmark suite', async () => {
    const results = await benchmark.runBenchmarkSuite();

    // Verify all tests completed
    expect(results.length).toBeGreaterThan(0);

    // Check critical performance targets
    const searchResults = results.filter(r => r.testName.includes('Search'));
    searchResults.forEach(result => {
      expect(result.metrics.p95ResponseTime).toBeLessThan(PERFORMANCE_TARGETS.SEARCH_RESPONSE_P95);
    });

    // Overall success rate should be high
    const passedTests = results.filter(r => r.passed).length;
    const successRate = passedTests / results.length;
    expect(successRate).toBeGreaterThan(0.8); // 80% of tests should pass

    console.log(`\n🎉 Benchmark completed: ${passedTests}/${results.length} tests passed (${(successRate * 100).toFixed(1)}%)`);
  }, 300000); // 5 minute timeout for complete benchmark
});

export { SearchPipelineBenchmark, BenchmarkResult, PERFORMANCE_TARGETS };