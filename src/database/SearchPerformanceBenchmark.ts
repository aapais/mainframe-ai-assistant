/**
 * Comprehensive Search Performance Benchmark
 *
 * Tests search operations specifically for 1000+ KB entries to ensure
 * sub-1s performance across various query types and conditions.
 */

import Database from 'better-sqlite3';
import { KnowledgeDB } from './KnowledgeDB';
import { SearchOptimizationEngine } from './SearchOptimizationEngine';

export interface BenchmarkResult {
  testName: string;
  totalOperations: number;
  duration: number;
  operationsPerSecond: number;
  averageLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  minLatency: number;
  maxLatency: number;
  errorRate: number;
  memoryUsed: number;
  cacheHitRate?: number;
  indexesUsed: string[];
  recommendations: string[];
}

export interface BenchmarkSuite {
  suiteName: string;
  description: string;
  results: BenchmarkResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averagePerformance: number;
    overallRecommendations: string[];
  };
}

export class SearchPerformanceBenchmark {
  private db: KnowledgeDB;
  private rawDb: Database.Database;
  private optimizationEngine?: SearchOptimizationEngine;

  constructor(db: KnowledgeDB) {
    this.db = db;
    this.rawDb = (db as any).db; // Access underlying SQLite database
  }

  /**
   * Run comprehensive benchmark suite for search operations
   */
  async runSearchBenchmark(
    options: {
      datasetSize?: number;
      iterations?: number;
      includeStressTest?: boolean;
      enableOptimizations?: boolean;
    } = {}
  ): Promise<BenchmarkSuite> {
    const {
      datasetSize = 1000,
      iterations = 100,
      includeStressTest = true,
      enableOptimizations = true,
    } = options;

    console.log(`🏁 Starting search performance benchmark with ${datasetSize} entries...`);

    // Initialize optimization engine if requested
    if (enableOptimizations && !this.optimizationEngine) {
      this.optimizationEngine = new SearchOptimizationEngine(this.rawDb);
    }

    // Ensure we have the required dataset size
    await this.ensureDatasetSize(datasetSize);

    const results: BenchmarkResult[] = [];

    // Test 1: Basic text search performance
    results.push(await this.benchmarkBasicTextSearch(iterations));

    // Test 2: Category-based search performance
    results.push(await this.benchmarkCategorySearch(iterations));

    // Test 3: Tag-based search performance
    results.push(await this.benchmarkTagSearch(iterations));

    // Test 4: Full-text search with BM25 ranking
    results.push(await this.benchmarkFullTextSearch(iterations));

    // Test 5: Popular entries retrieval
    results.push(await this.benchmarkPopularEntries(iterations));

    // Test 6: Recent entries retrieval
    results.push(await this.benchmarkRecentEntries(iterations));

    // Test 7: Complex multi-criteria search
    results.push(await this.benchmarkComplexSearch(iterations));

    // Test 8: Pagination performance
    results.push(await this.benchmarkPaginatedSearch(iterations));

    // Test 9: Auto-complete search
    results.push(await this.benchmarkAutoComplete(iterations));

    // Test 10: Cache performance
    results.push(await this.benchmarkCacheEfficiency(iterations));

    if (includeStressTest) {
      // Stress test: Concurrent searches
      results.push(await this.benchmarkConcurrentSearches(iterations));

      // Stress test: Large result sets
      results.push(await this.benchmarkLargeResultSets(iterations / 2));
    }

    // Analyze results and generate summary
    const summary = this.analyzeBenchmarkResults(results);

    return {
      suiteName: 'Search Performance Benchmark',
      description: `Performance testing for ${datasetSize} KB entries`,
      results,
      summary,
    };
  }

  /**
   * Benchmark basic text search operations
   */
  private async benchmarkBasicTextSearch(iterations: number): Promise<BenchmarkResult> {
    const testQueries = [
      'error',
      'failed',
      'timeout',
      'connection',
      'database',
      'file not found',
      'access denied',
      'invalid',
      'corrupt',
      'deadlock',
    ];

    const latencies: number[] = [];
    const indexesUsed: Set<string> = new Set();
    let errors = 0;

    const startMemory = process.memoryUsage().heapUsed;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const query = testQueries[i % testQueries.length];

      try {
        const operationStart = Date.now();

        // Execute search
        const results = await this.db.search(query, { limit: 10 });

        const latency = Date.now() - operationStart;
        latencies.push(latency);

        // Track index usage (simplified)
        indexesUsed.add('kb_fts_index');

        // Validate results
        if (results.length === 0 && i < 50) {
          console.warn(`No results for query: ${query}`);
        }
      } catch (error) {
        errors++;
        console.error(`Error in basic text search: ${error.message}`);
      }
    }

    const totalDuration = Date.now() - startTime;
    const endMemory = process.memoryUsage().heapUsed;

    return this.calculateBenchmarkResult({
      testName: 'Basic Text Search',
      latencies,
      totalDuration,
      totalOperations: iterations,
      errors,
      memoryDelta: endMemory - startMemory,
      indexesUsed: Array.from(indexesUsed),
      recommendations: this.getBasicSearchRecommendations(latencies),
    });
  }

  /**
   * Benchmark category-based search operations
   */
  private async benchmarkCategorySearch(iterations: number): Promise<BenchmarkResult> {
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'CICS', 'IMS', 'Other'];
    const latencies: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const category = categories[i % categories.length];

      try {
        const operationStart = Date.now();
        const results = await this.db.search(`category:${category}`, { limit: 20 });
        latencies.push(Date.now() - operationStart);
      } catch (error) {
        errors++;
      }
    }

    return this.calculateBenchmarkResult({
      testName: 'Category Search',
      latencies,
      totalDuration: Date.now() - startTime,
      totalOperations: iterations,
      errors,
      memoryDelta: 0,
      indexesUsed: ['idx_category_search'],
      recommendations: this.getCategorySearchRecommendations(latencies),
    });
  }

  /**
   * Benchmark tag-based search operations
   */
  private async benchmarkTagSearch(iterations: number): Promise<BenchmarkResult> {
    const tags = ['error', 'timeout', 'performance', 'security', 'network', 'storage', 'memory'];
    const latencies: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const tag = tags[i % tags.length];

      try {
        const operationStart = Date.now();
        const results = await this.db.search(`tag:${tag}`, { limit: 15 });
        latencies.push(Date.now() - operationStart);
      } catch (error) {
        errors++;
      }
    }

    return this.calculateBenchmarkResult({
      testName: 'Tag Search',
      latencies,
      totalDuration: Date.now() - startTime,
      totalOperations: iterations,
      errors,
      memoryDelta: 0,
      indexesUsed: ['idx_tag_search'],
      recommendations: this.getTagSearchRecommendations(latencies),
    });
  }

  /**
   * Benchmark full-text search with BM25 ranking
   */
  private async benchmarkFullTextSearch(iterations: number): Promise<BenchmarkResult> {
    const complexQueries = [
      'database connection timeout error',
      'file system access permission denied',
      'network connectivity issues troubleshooting',
      'memory allocation failure recovery',
      'application performance degradation analysis',
    ];

    const latencies: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const query = complexQueries[i % complexQueries.length];

      try {
        const operationStart = Date.now();
        const results = await this.db.search(query, {
          limit: 10,
          sortBy: 'relevance',
          enableHighlighting: true,
        });
        latencies.push(Date.now() - operationStart);
      } catch (error) {
        errors++;
      }
    }

    return this.calculateBenchmarkResult({
      testName: 'Full-Text Search (BM25)',
      latencies,
      totalDuration: Date.now() - startTime,
      totalOperations: iterations,
      errors,
      memoryDelta: 0,
      indexesUsed: ['kb_fts', 'idx_bm25_ranking'],
      recommendations: this.getFullTextSearchRecommendations(latencies),
    });
  }

  /**
   * Benchmark popular entries retrieval
   */
  private async benchmarkPopularEntries(iterations: number): Promise<BenchmarkResult> {
    const latencies: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      try {
        const operationStart = Date.now();
        const results = await this.db.getPopular(20);
        latencies.push(Date.now() - operationStart);
      } catch (error) {
        errors++;
      }
    }

    return this.calculateBenchmarkResult({
      testName: 'Popular Entries Retrieval',
      latencies,
      totalDuration: Date.now() - startTime,
      totalOperations: iterations,
      errors,
      memoryDelta: 0,
      indexesUsed: ['idx_usage_count', 'idx_success_rate'],
      recommendations: this.getPopularEntriesRecommendations(latencies),
    });
  }

  /**
   * Benchmark recent entries retrieval
   */
  private async benchmarkRecentEntries(iterations: number): Promise<BenchmarkResult> {
    const latencies: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      try {
        const operationStart = Date.now();
        const results = await this.db.getRecent(20);
        latencies.push(Date.now() - operationStart);
      } catch (error) {
        errors++;
      }
    }

    return this.calculateBenchmarkResult({
      testName: 'Recent Entries Retrieval',
      latencies,
      totalDuration: Date.now() - startTime,
      totalOperations: iterations,
      errors,
      memoryDelta: 0,
      indexesUsed: ['idx_created_at', 'idx_updated_at'],
      recommendations: this.getRecentEntriesRecommendations(latencies),
    });
  }

  /**
   * Benchmark complex multi-criteria search
   */
  private async benchmarkComplexSearch(iterations: number): Promise<BenchmarkResult> {
    const complexScenarios = [
      { category: 'DB2', severity: 'high', sortBy: 'usage' },
      { category: 'JCL', severity: 'critical', sortBy: 'success_rate' },
      { category: 'VSAM', severity: 'medium', sortBy: 'relevance' },
    ];

    const latencies: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const scenario = complexScenarios[i % complexScenarios.length];

      try {
        const operationStart = Date.now();
        const results = await this.db.searchWithFacets('error', {
          category: scenario.category,
          severity: scenario.severity,
          sortBy: scenario.sortBy as any,
          limit: 15,
        });
        latencies.push(Date.now() - operationStart);
      } catch (error) {
        errors++;
      }
    }

    return this.calculateBenchmarkResult({
      testName: 'Complex Multi-Criteria Search',
      latencies,
      totalDuration: Date.now() - startTime,
      totalOperations: iterations,
      errors,
      memoryDelta: 0,
      indexesUsed: ['idx_multi_criteria', 'idx_faceted_search'],
      recommendations: this.getComplexSearchRecommendations(latencies),
    });
  }

  /**
   * Benchmark paginated search performance
   */
  private async benchmarkPaginatedSearch(iterations: number): Promise<BenchmarkResult> {
    const latencies: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const offset = (i % 10) * 10; // Test different pages

      try {
        const operationStart = Date.now();
        const results = await this.db.search('system', {
          limit: 10,
          offset,
        });
        latencies.push(Date.now() - operationStart);
      } catch (error) {
        errors++;
      }
    }

    return this.calculateBenchmarkResult({
      testName: 'Paginated Search',
      latencies,
      totalDuration: Date.now() - startTime,
      totalOperations: iterations,
      errors,
      memoryDelta: 0,
      indexesUsed: ['idx_pagination_optimized'],
      recommendations: this.getPaginationRecommendations(latencies),
    });
  }

  /**
   * Benchmark auto-complete functionality
   */
  private async benchmarkAutoComplete(iterations: number): Promise<BenchmarkResult> {
    const prefixes = ['err', 'sys', 'data', 'conn', 'file', 'net', 'mem', 'perf'];
    const latencies: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      const prefix = prefixes[i % prefixes.length];

      try {
        const operationStart = Date.now();
        const results = await this.db.autoComplete(prefix, 10);
        latencies.push(Date.now() - operationStart);
      } catch (error) {
        errors++;
      }
    }

    return this.calculateBenchmarkResult({
      testName: 'Auto-Complete Search',
      latencies,
      totalDuration: Date.now() - startTime,
      totalOperations: iterations,
      errors,
      memoryDelta: 0,
      indexesUsed: ['idx_autocomplete'],
      recommendations: this.getAutoCompleteRecommendations(latencies),
    });
  }

  /**
   * Benchmark cache efficiency
   */
  private async benchmarkCacheEfficiency(iterations: number): Promise<BenchmarkResult> {
    const cachedQueries = ['popular query', 'common error', 'frequent search'];
    const latencies: number[] = [];
    let cacheHits = 0;
    let errors = 0;

    const startTime = Date.now();

    // First pass - populate cache
    for (const query of cachedQueries) {
      await this.db.search(query);
    }

    // Second pass - test cache hits
    for (let i = 0; i < iterations; i++) {
      const query = cachedQueries[i % cachedQueries.length];

      try {
        const operationStart = Date.now();
        const results = await this.db.search(query);
        const latency = Date.now() - operationStart;
        latencies.push(latency);

        // Assume cache hit if latency is very low
        if (latency < 50) cacheHits++;
      } catch (error) {
        errors++;
      }
    }

    const cacheHitRate = (cacheHits / iterations) * 100;

    return this.calculateBenchmarkResult({
      testName: 'Cache Efficiency',
      latencies,
      totalDuration: Date.now() - startTime,
      totalOperations: iterations,
      errors,
      memoryDelta: 0,
      indexesUsed: ['cache_system'],
      recommendations: this.getCacheRecommendations(latencies, cacheHitRate),
      cacheHitRate,
    });
  }

  /**
   * Benchmark concurrent search operations
   */
  private async benchmarkConcurrentSearches(iterations: number): Promise<BenchmarkResult> {
    const concurrency = 10;
    const queriesPerThread = Math.floor(iterations / concurrency);
    const queries = ['error', 'system', 'database', 'network', 'file'];

    const latencies: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    // Create concurrent search operations
    const searchPromises = Array.from({ length: concurrency }, async (_, threadIndex) => {
      const threadLatencies: number[] = [];

      for (let i = 0; i < queriesPerThread; i++) {
        const query = queries[(threadIndex + i) % queries.length];

        try {
          const operationStart = Date.now();
          const results = await this.db.search(query);
          threadLatencies.push(Date.now() - operationStart);
        } catch (error) {
          errors++;
        }
      }

      return threadLatencies;
    });

    // Wait for all concurrent operations to complete
    const threadResults = await Promise.all(searchPromises);

    // Combine all latencies
    threadResults.forEach(threadLatencies => {
      latencies.push(...threadLatencies);
    });

    return this.calculateBenchmarkResult({
      testName: 'Concurrent Search Operations',
      latencies,
      totalDuration: Date.now() - startTime,
      totalOperations: latencies.length,
      errors,
      memoryDelta: 0,
      indexesUsed: ['connection_pool', 'concurrent_indexes'],
      recommendations: this.getConcurrencyRecommendations(latencies),
    });
  }

  /**
   * Benchmark large result set handling
   */
  private async benchmarkLargeResultSets(iterations: number): Promise<BenchmarkResult> {
    const latencies: number[] = [];
    let errors = 0;

    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      try {
        const operationStart = Date.now();
        // Request large result sets
        const results = await this.db.search('system', { limit: 100 });
        latencies.push(Date.now() - operationStart);
      } catch (error) {
        errors++;
      }
    }

    return this.calculateBenchmarkResult({
      testName: 'Large Result Sets',
      latencies,
      totalDuration: Date.now() - startTime,
      totalOperations: iterations,
      errors,
      memoryDelta: 0,
      indexesUsed: ['idx_large_results'],
      recommendations: this.getLargeResultsRecommendations(latencies),
    });
  }

  /**
   * Calculate benchmark result from raw data
   */
  private calculateBenchmarkResult(data: {
    testName: string;
    latencies: number[];
    totalDuration: number;
    totalOperations: number;
    errors: number;
    memoryDelta: number;
    indexesUsed: string[];
    recommendations: string[];
    cacheHitRate?: number;
  }): BenchmarkResult {
    const { latencies, totalDuration, totalOperations, errors } = data;

    if (latencies.length === 0) {
      return {
        testName: data.testName,
        totalOperations,
        duration: totalDuration,
        operationsPerSecond: 0,
        averageLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        minLatency: 0,
        maxLatency: 0,
        errorRate: 100,
        memoryUsed: data.memoryDelta,
        cacheHitRate: data.cacheHitRate,
        indexesUsed: data.indexesUsed,
        recommendations: [
          ...data.recommendations,
          'All operations failed - investigate immediately',
        ],
      };
    }

    // Sort latencies for percentile calculations
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const totalLatencies = sortedLatencies.length;

    return {
      testName: data.testName,
      totalOperations,
      duration: totalDuration,
      operationsPerSecond: (totalOperations / totalDuration) * 1000,
      averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / totalLatencies,
      p50Latency: sortedLatencies[Math.floor(totalLatencies * 0.5)],
      p95Latency: sortedLatencies[Math.floor(totalLatencies * 0.95)],
      p99Latency: sortedLatencies[Math.floor(totalLatencies * 0.99)],
      minLatency: sortedLatencies[0],
      maxLatency: sortedLatencies[totalLatencies - 1],
      errorRate: (errors / totalOperations) * 100,
      memoryUsed: data.memoryDelta,
      cacheHitRate: data.cacheHitRate,
      indexesUsed: data.indexesUsed,
      recommendations: data.recommendations,
    };
  }

  /**
   * Analyze all benchmark results and generate summary
   */
  private analyzeBenchmarkResults(results: BenchmarkResult[]): BenchmarkSuite['summary'] {
    const passedTests = results.filter(r => r.averageLatency < 1000 && r.errorRate < 5).length;
    const failedTests = results.length - passedTests;
    const averagePerformance =
      results.reduce((sum, r) => sum + r.operationsPerSecond, 0) / results.length;

    const overallRecommendations: string[] = [];

    // Global performance analysis
    const slowTests = results.filter(r => r.p95Latency > 1000);
    if (slowTests.length > 0) {
      overallRecommendations.push(
        `${slowTests.length} tests have P95 latency > 1s - requires optimization`
      );
    }

    const highErrorRateTests = results.filter(r => r.errorRate > 1);
    if (highErrorRateTests.length > 0) {
      overallRecommendations.push(
        `${highErrorRateTests.length} tests have error rates > 1% - investigate failures`
      );
    }

    if (averagePerformance < 100) {
      overallRecommendations.push('Overall performance below target - consider index optimization');
    }

    return {
      totalTests: results.length,
      passedTests,
      failedTests,
      averagePerformance: Math.round(averagePerformance),
      overallRecommendations,
    };
  }

  /**
   * Ensure we have sufficient data for meaningful benchmarks
   */
  private async ensureDatasetSize(targetSize: number): Promise<void> {
    const currentSize = this.db.getEntryCount();

    if (currentSize < targetSize) {
      console.log(
        `📊 Current dataset: ${currentSize} entries. Target: ${targetSize}. Generating additional entries...`
      );
      await this.generateTestData(targetSize - currentSize);
    } else {
      console.log(`✅ Dataset ready: ${currentSize} entries`);
    }
  }

  /**
   * Generate test data for benchmarking
   */
  private async generateTestData(count: number): Promise<void> {
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'CICS', 'IMS', 'Other'];
    const severities = ['critical', 'high', 'medium', 'low'] as const;
    const baseProblems = [
      'System error occurred during processing',
      'Database connection timeout',
      'File not found error',
      'Memory allocation failure',
      'Network connectivity issue',
      'Permission denied access',
      'Invalid parameter specified',
      'Resource temporarily unavailable',
      'Operation timed out',
      'Configuration error detected',
    ];

    const baseSolutions = [
      'Restart the service and check logs',
      'Verify network connectivity',
      'Check file permissions',
      'Increase timeout values',
      'Review configuration settings',
      'Contact system administrator',
      'Clear cache and retry',
      'Update system resources',
      'Check system status',
      'Review error logs',
    ];

    for (let i = 0; i < count; i++) {
      const entry = {
        title: `Test Entry ${i + 1000}: ${baseProblems[i % baseProblems.length]}`,
        problem: `${baseProblems[i % baseProblems.length]} - Additional context for entry ${i + 1000}`,
        solution: `${baseSolutions[i % baseSolutions.length]} - Specific steps for issue ${i + 1000}`,
        category: categories[i % categories.length],
        severity: severities[i % severities.length],
        tags: [`test-${i}`, `benchmark`, `performance`],
      };

      await this.db.addEntry(entry, 'benchmark-system');

      if (i % 100 === 0) {
        console.log(`Generated ${i}/${count} test entries...`);
      }
    }

    console.log(`✅ Generated ${count} test entries for benchmarking`);
  }

  // Recommendation methods for each benchmark type
  private getBasicSearchRecommendations(latencies: number[]): string[] {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    if (avgLatency > 500) recommendations.push('Consider FTS index optimization');
    if (Math.max(...latencies) > 2000) recommendations.push('Investigate slow query outliers');

    return recommendations;
  }

  private getCategorySearchRecommendations(latencies: number[]): string[] {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    if (avgLatency > 200) recommendations.push('Add category covering index');

    return recommendations;
  }

  private getTagSearchRecommendations(latencies: number[]): string[] {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    if (avgLatency > 300) recommendations.push('Optimize tag junction table');

    return recommendations;
  }

  private getFullTextSearchRecommendations(latencies: number[]): string[] {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    if (avgLatency > 800) recommendations.push('Rebuild FTS index');

    return recommendations;
  }

  private getPopularEntriesRecommendations(latencies: number[]): string[] {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    if (avgLatency > 100) recommendations.push('Cache popular entries');

    return recommendations;
  }

  private getRecentEntriesRecommendations(latencies: number[]): string[] {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    if (avgLatency > 150) recommendations.push('Optimize timestamp indexes');

    return recommendations;
  }

  private getComplexSearchRecommendations(latencies: number[]): string[] {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    if (avgLatency > 1000) recommendations.push('Add composite indexes for multi-criteria queries');

    return recommendations;
  }

  private getPaginationRecommendations(latencies: number[]): string[] {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    if (avgLatency > 400) recommendations.push('Implement cursor-based pagination');

    return recommendations;
  }

  private getAutoCompleteRecommendations(latencies: number[]): string[] {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    if (avgLatency > 50) recommendations.push('Implement prefix tree for autocomplete');

    return recommendations;
  }

  private getCacheRecommendations(latencies: number[], cacheHitRate: number): string[] {
    const recommendations = [];

    if (cacheHitRate < 70) recommendations.push('Increase cache TTL for frequent queries');
    if (cacheHitRate < 50) recommendations.push('Review cache eviction strategy');

    return recommendations;
  }

  private getConcurrencyRecommendations(latencies: number[]): string[] {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    if (avgLatency > 600) recommendations.push('Increase connection pool size');

    return recommendations;
  }

  private getLargeResultsRecommendations(latencies: number[]): string[] {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    if (avgLatency > 1500) recommendations.push('Implement streaming for large result sets');

    return recommendations;
  }
}
