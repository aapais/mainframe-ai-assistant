'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SearchPerformanceBenchmark = void 0;
const SearchOptimizationEngine_1 = require('./SearchOptimizationEngine');
class SearchPerformanceBenchmark {
  db;
  rawDb;
  optimizationEngine;
  constructor(db) {
    this.db = db;
    this.rawDb = db.db;
  }
  async runSearchBenchmark(options = {}) {
    const {
      datasetSize = 1000,
      iterations = 100,
      includeStressTest = true,
      enableOptimizations = true,
    } = options;
    console.log(`🏁 Starting search performance benchmark with ${datasetSize} entries...`);
    if (enableOptimizations && !this.optimizationEngine) {
      this.optimizationEngine = new SearchOptimizationEngine_1.SearchOptimizationEngine(this.rawDb);
    }
    await this.ensureDatasetSize(datasetSize);
    const results = [];
    results.push(await this.benchmarkBasicTextSearch(iterations));
    results.push(await this.benchmarkCategorySearch(iterations));
    results.push(await this.benchmarkTagSearch(iterations));
    results.push(await this.benchmarkFullTextSearch(iterations));
    results.push(await this.benchmarkPopularEntries(iterations));
    results.push(await this.benchmarkRecentEntries(iterations));
    results.push(await this.benchmarkComplexSearch(iterations));
    results.push(await this.benchmarkPaginatedSearch(iterations));
    results.push(await this.benchmarkAutoComplete(iterations));
    results.push(await this.benchmarkCacheEfficiency(iterations));
    if (includeStressTest) {
      results.push(await this.benchmarkConcurrentSearches(iterations));
      results.push(await this.benchmarkLargeResultSets(iterations / 2));
    }
    const summary = this.analyzeBenchmarkResults(results);
    return {
      suiteName: 'Search Performance Benchmark',
      description: `Performance testing for ${datasetSize} KB entries`,
      results,
      summary,
    };
  }
  async benchmarkBasicTextSearch(iterations) {
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
    const latencies = [];
    const indexesUsed = new Set();
    let errors = 0;
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = Date.now();
    for (let i = 0; i < iterations; i++) {
      const query = testQueries[i % testQueries.length];
      try {
        const operationStart = Date.now();
        const results = await this.db.search(query, { limit: 10 });
        const latency = Date.now() - operationStart;
        latencies.push(latency);
        indexesUsed.add('kb_fts_index');
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
  async benchmarkCategorySearch(iterations) {
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'CICS', 'IMS', 'Other'];
    const latencies = [];
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
  async benchmarkTagSearch(iterations) {
    const tags = ['error', 'timeout', 'performance', 'security', 'network', 'storage', 'memory'];
    const latencies = [];
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
  async benchmarkFullTextSearch(iterations) {
    const complexQueries = [
      'database connection timeout error',
      'file system access permission denied',
      'network connectivity issues troubleshooting',
      'memory allocation failure recovery',
      'application performance degradation analysis',
    ];
    const latencies = [];
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
  async benchmarkPopularEntries(iterations) {
    const latencies = [];
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
  async benchmarkRecentEntries(iterations) {
    const latencies = [];
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
  async benchmarkComplexSearch(iterations) {
    const complexScenarios = [
      { category: 'DB2', severity: 'high', sortBy: 'usage' },
      { category: 'JCL', severity: 'critical', sortBy: 'success_rate' },
      { category: 'VSAM', severity: 'medium', sortBy: 'relevance' },
    ];
    const latencies = [];
    let errors = 0;
    const startTime = Date.now();
    for (let i = 0; i < iterations; i++) {
      const scenario = complexScenarios[i % complexScenarios.length];
      try {
        const operationStart = Date.now();
        const results = await this.db.searchWithFacets('error', {
          category: scenario.category,
          severity: scenario.severity,
          sortBy: scenario.sortBy,
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
  async benchmarkPaginatedSearch(iterations) {
    const latencies = [];
    let errors = 0;
    const startTime = Date.now();
    for (let i = 0; i < iterations; i++) {
      const offset = (i % 10) * 10;
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
  async benchmarkAutoComplete(iterations) {
    const prefixes = ['err', 'sys', 'data', 'conn', 'file', 'net', 'mem', 'perf'];
    const latencies = [];
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
  async benchmarkCacheEfficiency(iterations) {
    const cachedQueries = ['popular query', 'common error', 'frequent search'];
    const latencies = [];
    let cacheHits = 0;
    let errors = 0;
    const startTime = Date.now();
    for (const query of cachedQueries) {
      await this.db.search(query);
    }
    for (let i = 0; i < iterations; i++) {
      const query = cachedQueries[i % cachedQueries.length];
      try {
        const operationStart = Date.now();
        const results = await this.db.search(query);
        const latency = Date.now() - operationStart;
        latencies.push(latency);
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
  async benchmarkConcurrentSearches(iterations) {
    const concurrency = 10;
    const queriesPerThread = Math.floor(iterations / concurrency);
    const queries = ['error', 'system', 'database', 'network', 'file'];
    const latencies = [];
    let errors = 0;
    const startTime = Date.now();
    const searchPromises = Array.from({ length: concurrency }, async (_, threadIndex) => {
      const threadLatencies = [];
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
    const threadResults = await Promise.all(searchPromises);
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
  async benchmarkLargeResultSets(iterations) {
    const latencies = [];
    let errors = 0;
    const startTime = Date.now();
    for (let i = 0; i < iterations; i++) {
      try {
        const operationStart = Date.now();
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
  calculateBenchmarkResult(data) {
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
  analyzeBenchmarkResults(results) {
    const passedTests = results.filter(r => r.averageLatency < 1000 && r.errorRate < 5).length;
    const failedTests = results.length - passedTests;
    const averagePerformance =
      results.reduce((sum, r) => sum + r.operationsPerSecond, 0) / results.length;
    const overallRecommendations = [];
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
  async ensureDatasetSize(targetSize) {
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
  async generateTestData(count) {
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'CICS', 'IMS', 'Other'];
    const severities = ['critical', 'high', 'medium', 'low'];
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
  getBasicSearchRecommendations(latencies) {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency > 500) recommendations.push('Consider FTS index optimization');
    if (Math.max(...latencies) > 2000) recommendations.push('Investigate slow query outliers');
    return recommendations;
  }
  getCategorySearchRecommendations(latencies) {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency > 200) recommendations.push('Add category covering index');
    return recommendations;
  }
  getTagSearchRecommendations(latencies) {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency > 300) recommendations.push('Optimize tag junction table');
    return recommendations;
  }
  getFullTextSearchRecommendations(latencies) {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency > 800) recommendations.push('Rebuild FTS index');
    return recommendations;
  }
  getPopularEntriesRecommendations(latencies) {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency > 100) recommendations.push('Cache popular entries');
    return recommendations;
  }
  getRecentEntriesRecommendations(latencies) {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency > 150) recommendations.push('Optimize timestamp indexes');
    return recommendations;
  }
  getComplexSearchRecommendations(latencies) {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency > 1000) recommendations.push('Add composite indexes for multi-criteria queries');
    return recommendations;
  }
  getPaginationRecommendations(latencies) {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency > 400) recommendations.push('Implement cursor-based pagination');
    return recommendations;
  }
  getAutoCompleteRecommendations(latencies) {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency > 50) recommendations.push('Implement prefix tree for autocomplete');
    return recommendations;
  }
  getCacheRecommendations(latencies, cacheHitRate) {
    const recommendations = [];
    if (cacheHitRate < 70) recommendations.push('Increase cache TTL for frequent queries');
    if (cacheHitRate < 50) recommendations.push('Review cache eviction strategy');
    return recommendations;
  }
  getConcurrencyRecommendations(latencies) {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency > 600) recommendations.push('Increase connection pool size');
    return recommendations;
  }
  getLargeResultsRecommendations(latencies) {
    const recommendations = [];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    if (avgLatency > 1500) recommendations.push('Implement streaming for large result sets');
    return recommendations;
  }
}
exports.SearchPerformanceBenchmark = SearchPerformanceBenchmark;
//# sourceMappingURL=SearchPerformanceBenchmark.js.map
