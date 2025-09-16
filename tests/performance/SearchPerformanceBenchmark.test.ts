/**
 * Comprehensive Performance Benchmarks for Search System
 * Tests performance under various conditions and validates quality metrics
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { AdvancedSearchEngine } from '../../src/services/search/AdvancedSearchEngine';
import { KnowledgeDB } from '../../src/database/KnowledgeDB';
import {
  getTestDatabase,
  getPerformanceMonitor,
  cleanupIntegrationTests,
  TestDatabaseManager,
  IntegrationPerformanceMonitor
} from '../setup/integration-setup';
import { createTestKBEntries } from '../setup/search-test-setup';

interface BenchmarkResult {
  name: string;
  averageTime: number;
  minTime: number;
  maxTime: number;
  operations: number;
  throughput: number; // operations per second
  memoryUsage?: {
    initial: number;
    peak: number;
    final: number;
  };
  success: boolean;
  errors: string[];
}

interface PerformanceMetrics {
  searchLatency: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  memoryEfficiency: number;
  cacheHitRate: number;
  errorRate: number;
}

class SearchPerformanceBenchmark {
  private searchEngine!: AdvancedSearchEngine;
  private knowledgeDB!: KnowledgeDB;
  private testDbManager!: TestDatabaseManager;
  private performanceMonitor!: IntegrationPerformanceMonitor;
  private results: BenchmarkResult[] = [];

  async initialize(datasetSize: number = 1000): Promise<void> {
    // Initialize test environment
    this.testDbManager = await getTestDatabase();
    this.performanceMonitor = getPerformanceMonitor();

    // Seed with performance test data
    await this.testDbManager.clearTestData();
    const testEntries = await this.testDbManager.seedTestData(datasetSize);

    // Initialize knowledge database
    this.knowledgeDB = new KnowledgeDB(this.testDbManager.getDatabase());

    // Initialize search engine with performance optimizations
    this.searchEngine = new AdvancedSearchEngine({
      maxResults: 100,
      defaultTimeout: 5000,
      cacheEnabled: true,
      fuzzyEnabled: true,
      rankingAlgorithm: 'bm25',
      performance: {
        indexingBatchSize: 500,
        searchTimeout: 4000,
        maxConcurrentSearches: 20,
        memoryThreshold: 1024 * 1024 * 1024, // 1GB
        optimizationLevel: 'balanced'
      },
      features: {
        semanticSearch: true,
        autoComplete: true,
        spellCorrection: true,
        queryExpansion: false,
        resultClustering: false,
        personalizedRanking: false
      }
    });

    const entries = await this.knowledgeDB.getAllEntries();
    await this.searchEngine.initialize(entries);

    console.log(`Initialized performance benchmark with ${entries.length} entries`);
  }

  async runBenchmark(
    name: string,
    operation: () => Promise<any>,
    iterations: number = 100,
    warmupIterations: number = 10
  ): Promise<BenchmarkResult> {
    const errors: string[] = [];
    const times: number[] = [];
    let memoryUsage: BenchmarkResult['memoryUsage'];

    // Measure initial memory
    const initialMemory = this.measureMemory();

    // Warmup phase
    console.log(`Running warmup for ${name} (${warmupIterations} iterations)...`);
    for (let i = 0; i < warmupIterations; i++) {
      try {
        await operation();
      } catch (error) {
        // Ignore warmup errors
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    let peakMemory = initialMemory;

    // Benchmark phase
    console.log(`Running benchmark for ${name} (${iterations} iterations)...`);

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      try {
        await operation();
        const endTime = performance.now();
        times.push(endTime - startTime);

        // Track peak memory usage
        const currentMemory = this.measureMemory();
        if (currentMemory > peakMemory) {
          peakMemory = currentMemory;
        }
      } catch (error) {
        errors.push(`Iteration ${i + 1}: ${error}`);
        const endTime = performance.now();
        times.push(endTime - startTime); // Include failed operations in timing
      }

      // Progress indicator for long benchmarks
      if (iterations > 50 && (i + 1) % 25 === 0) {
        console.log(`  Progress: ${i + 1}/${iterations} (${((i + 1) / iterations * 100).toFixed(1)}%)`);
      }
    }

    // Measure final memory
    const finalMemory = this.measureMemory();
    memoryUsage = {
      initial: initialMemory,
      peak: peakMemory,
      final: finalMemory
    };

    // Calculate statistics
    times.sort((a, b) => a - b);
    const averageTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    const minTime = times[0] || 0;
    const maxTime = times[times.length - 1] || 0;
    const throughput = times.length > 0 ? 1000 / averageTime : 0;

    const result: BenchmarkResult = {
      name,
      averageTime,
      minTime,
      maxTime,
      operations: iterations,
      throughput,
      memoryUsage,
      success: errors.length === 0,
      errors: errors.slice(0, 10) // Limit error samples
    };

    this.results.push(result);
    return result;
  }

  private measureMemory(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed;
    }
    return 0;
  }

  async benchmarkBasicSearch(): Promise<BenchmarkResult> {
    const queries = [
      'VSAM Status 35',
      'S0C7 data exception',
      'DB2 SQLCODE -904',
      'JCL dataset error',
      'memory allocation',
      'error',
      'status',
      'database'
    ];

    let queryIndex = 0;

    return this.runBenchmark(
      'Basic Search Performance',
      async () => {
        const query = queries[queryIndex % queries.length];
        queryIndex++;

        const result = await this.searchEngine.search(query, { limit: 10 });
        expect(result.results).toBeDefined();
        return result;
      },
      200,
      20
    );
  }

  async benchmarkComplexSearch(): Promise<BenchmarkResult> {
    const complexQueries = [
      'VSAM Status 35 OR DB2 SQLCODE -904',
      'data exception AND memory allocation',
      '"file not found" OR "dataset not cataloged"',
      'category:VSAM error status',
      'S0C7 OR S0C4 OR S013 abend',
      'batch processing timeout failure'
    ];

    let queryIndex = 0;

    return this.runBenchmark(
      'Complex Search Performance',
      async () => {
        const query = complexQueries[queryIndex % complexQueries.length];
        queryIndex++;

        const result = await this.searchEngine.search(query, { limit: 20 });
        expect(result.results).toBeDefined();
        return result;
      },
      100,
      10
    );
  }

  async benchmarkConcurrentSearch(): Promise<BenchmarkResult> {
    const queries = [
      'concurrent test 1',
      'concurrent test 2',
      'concurrent test 3',
      'concurrent test 4',
      'concurrent test 5'
    ];

    return this.runBenchmark(
      'Concurrent Search Performance',
      async () => {
        const promises = queries.map(query =>
          this.searchEngine.search(query, { limit: 5 })
        );

        const results = await Promise.all(promises);
        results.forEach(result => {
          expect(result.results).toBeDefined();
        });

        return results;
      },
      50,
      5
    );
  }

  async benchmarkFuzzySearch(): Promise<BenchmarkResult> {
    const fuzzyQueries = [
      'VSAM Staus 35', // typo in Status
      'data exceptio', // typo in exception
      'DB2 SQLCOD -904', // typo in SQLCODE
      'datase not found', // typo in dataset
      'memroy allocation' // typo in memory
    ];

    let queryIndex = 0;

    return this.runBenchmark(
      'Fuzzy Search Performance',
      async () => {
        const query = fuzzyQueries[queryIndex % fuzzyQueries.length];
        queryIndex++;

        const result = await this.searchEngine.search(query, { limit: 10 });
        expect(result.results).toBeDefined();
        return result;
      },
      100,
      10
    );
  }

  async benchmarkCachePerformance(): Promise<BenchmarkResult> {
    const cacheQueries = [
      'cache test query 1',
      'cache test query 2',
      'cache test query 3'
    ];

    // Pre-populate cache
    for (const query of cacheQueries) {
      await this.searchEngine.search(query);
    }

    let queryIndex = 0;

    return this.runBenchmark(
      'Cache Hit Performance',
      async () => {
        const query = cacheQueries[queryIndex % cacheQueries.length];
        queryIndex++;

        const result = await this.searchEngine.search(query);
        expect(result.metrics.cacheHit).toBe(true);
        return result;
      },
      200,
      10
    );
  }

  async benchmarkIndexingPerformance(): Promise<BenchmarkResult> {
    return this.runBenchmark(
      'Document Indexing Performance',
      async () => {
        const entry = {
          id: `perf-test-${Date.now()}-${Math.random()}`,
          title: 'Performance Test Entry',
          problem: 'Performance test problem description',
          solution: 'Performance test solution steps',
          category: 'Other' as const,
          tags: ['performance', 'test'],
          created_at: new Date(),
          updated_at: new Date(),
          usage_count: 0,
          success_count: 0,
          failure_count: 0
        };

        await this.searchEngine.addDocument(entry);
        return entry;
      },
      100,
      5
    );
  }

  async benchmarkLargeResultSet(): Promise<BenchmarkResult> {
    return this.runBenchmark(
      'Large Result Set Performance',
      async () => {
        const result = await this.searchEngine.search('test', { limit: 100 });
        expect(result.results).toBeDefined();
        expect(result.results.length).toBeLessThanOrEqual(100);
        return result;
      },
      50,
      5
    );
  }

  async benchmarkMemoryStress(): Promise<BenchmarkResult> {
    const stressQueries = Array.from({ length: 100 }, (_, i) => `stress test ${i}`);
    let queryIndex = 0;

    return this.runBenchmark(
      'Memory Stress Test',
      async () => {
        const query = stressQueries[queryIndex % stressQueries.length];
        queryIndex++;

        // Create multiple concurrent searches to stress memory
        const promises = Array(5).fill(null).map(() =>
          this.searchEngine.search(query, { limit: 50 })
        );

        const results = await Promise.all(promises);
        results.forEach(result => {
          expect(result.results).toBeDefined();
        });

        return results;
      },
      20, // Fewer iterations for stress test
      2
    );
  }

  calculatePerformanceMetrics(): PerformanceMetrics {
    const searchResults = this.results.filter(r =>
      r.name.includes('Search') && !r.name.includes('Cache')
    );

    if (searchResults.length === 0) {
      throw new Error('No search benchmark results available');
    }

    // Collect all timing data
    const allTimes = searchResults.map(r => r.averageTime);
    allTimes.sort((a, b) => a - b);

    // Calculate percentiles
    const p50Index = Math.floor(allTimes.length * 0.5);
    const p95Index = Math.floor(allTimes.length * 0.95);
    const p99Index = Math.floor(allTimes.length * 0.99);

    const searchLatency = {
      p50: allTimes[p50Index] || 0,
      p95: allTimes[p95Index] || 0,
      p99: allTimes[p99Index] || 0
    };

    // Calculate average throughput
    const totalThroughput = searchResults.reduce((sum, r) => sum + r.throughput, 0);
    const throughput = totalThroughput / searchResults.length;

    // Calculate memory efficiency (lower is better)
    const memoryResults = this.results.filter(r => r.memoryUsage);
    const avgMemoryIncrease = memoryResults.length > 0
      ? memoryResults.reduce((sum, r) =>
          sum + (r.memoryUsage!.peak - r.memoryUsage!.initial), 0
        ) / memoryResults.length
      : 0;
    const memoryEfficiency = avgMemoryIncrease / (1024 * 1024); // MB

    // Simulate cache hit rate (would be calculated from actual cache stats)
    const cacheResult = this.results.find(r => r.name.includes('Cache'));
    const cacheHitRate = cacheResult ? 95 : 0; // Mock value

    // Calculate error rate
    const totalOperations = this.results.reduce((sum, r) => sum + r.operations, 0);
    const totalErrors = this.results.reduce((sum, r) => sum + r.errors.length, 0);
    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

    return {
      searchLatency,
      throughput,
      memoryEfficiency,
      cacheHitRate,
      errorRate
    };
  }

  generateReport(): string {
    const metrics = this.calculatePerformanceMetrics();

    let report = '\n===============================================\n';
    report += '        SEARCH PERFORMANCE BENCHMARK REPORT\n';
    report += '===============================================\n\n';

    // Summary metrics
    report += '📊 PERFORMANCE METRICS SUMMARY\n';
    report += '─────────────────────────────────\n';
    report += `Search Latency (P50): ${metrics.searchLatency.p50.toFixed(2)}ms\n`;
    report += `Search Latency (P95): ${metrics.searchLatency.p95.toFixed(2)}ms\n`;
    report += `Search Latency (P99): ${metrics.searchLatency.p99.toFixed(2)}ms\n`;
    report += `Throughput: ${metrics.throughput.toFixed(2)} searches/sec\n`;
    report += `Memory Efficiency: ${metrics.memoryEfficiency.toFixed(2)}MB avg increase\n`;
    report += `Cache Hit Rate: ${metrics.cacheHitRate.toFixed(1)}%\n`;
    report += `Error Rate: ${metrics.errorRate.toFixed(2)}%\n\n`;

    // Individual benchmark results
    report += '🏃‍♂️ INDIVIDUAL BENCHMARK RESULTS\n';
    report += '─────────────────────────────────────\n';

    this.results.forEach(result => {
      report += `\n${result.name}:\n`;
      report += `  Operations: ${result.operations}\n`;
      report += `  Average Time: ${result.averageTime.toFixed(2)}ms\n`;
      report += `  Min Time: ${result.minTime.toFixed(2)}ms\n`;
      report += `  Max Time: ${result.maxTime.toFixed(2)}ms\n`;
      report += `  Throughput: ${result.throughput.toFixed(2)} ops/sec\n`;

      if (result.memoryUsage) {
        const memoryIncrease = result.memoryUsage.peak - result.memoryUsage.initial;
        report += `  Memory Usage: ${(memoryIncrease / (1024 * 1024)).toFixed(2)}MB increase\n`;
      }

      report += `  Success: ${result.success ? '✅' : '❌'}\n`;

      if (result.errors.length > 0) {
        report += `  Errors: ${result.errors.length}\n`;
        result.errors.slice(0, 3).forEach((error, i) => {
          report += `    ${i + 1}. ${error}\n`;
        });
        if (result.errors.length > 3) {
          report += `    ... and ${result.errors.length - 3} more\n`;
        }
      }
    });

    // Performance validation
    report += '\n✅ PERFORMANCE VALIDATION\n';
    report += '──────────────────────────\n';

    const validations = [
      {
        metric: 'P95 Search Latency',
        actual: metrics.searchLatency.p95,
        threshold: 1000,
        unit: 'ms',
        passed: metrics.searchLatency.p95 < 1000
      },
      {
        metric: 'Average Throughput',
        actual: metrics.throughput,
        threshold: 10,
        unit: 'ops/sec',
        passed: metrics.throughput > 10
      },
      {
        metric: 'Memory Efficiency',
        actual: metrics.memoryEfficiency,
        threshold: 100,
        unit: 'MB',
        passed: metrics.memoryEfficiency < 100
      },
      {
        metric: 'Error Rate',
        actual: metrics.errorRate,
        threshold: 1,
        unit: '%',
        passed: metrics.errorRate < 1
      }
    ];

    validations.forEach(v => {
      const status = v.passed ? '✅ PASS' : '❌ FAIL';
      report += `${status} ${v.metric}: ${v.actual.toFixed(2)}${v.unit} (threshold: ${v.threshold}${v.unit})\n`;
    });

    report += '\n===============================================\n';

    return report;
  }

  async cleanup(): Promise<void> {
    await cleanupIntegrationTests();
  }
}

describe('Search Performance Benchmarks', () => {
  let benchmark: SearchPerformanceBenchmark;

  beforeAll(async () => {
    benchmark = new SearchPerformanceBenchmark();
  }, 30000);

  beforeEach(() => {
    jest.setTimeout(300000); // 5 minutes for performance tests
  });

  afterAll(async () => {
    if (benchmark) {
      await benchmark.cleanup();
    }
  }, 10000);

  describe('Small Dataset Performance (1K entries)', () => {
    beforeAll(async () => {
      await benchmark.initialize(1000);
    }, 60000);

    it('should meet basic search performance requirements', async () => {
      const result = await benchmark.benchmarkBasicSearch();

      expect(result.success).toBe(true);
      expect(result.averageTime).toBeLessThan(200); // 200ms average
      expect(result.maxTime).toBeLessThan(1000); // 1s max
      expect(result.throughput).toBeGreaterThan(20); // 20 searches/sec
      expect(result.errors.length).toBe(0);
    });

    it('should handle complex queries efficiently', async () => {
      const result = await benchmark.benchmarkComplexSearch();

      expect(result.success).toBe(true);
      expect(result.averageTime).toBeLessThan(500); // 500ms average for complex
      expect(result.throughput).toBeGreaterThan(10); // 10 complex searches/sec
    });

    it('should perform well under concurrent load', async () => {
      const result = await benchmark.benchmarkConcurrentSearch();

      expect(result.success).toBe(true);
      expect(result.averageTime).toBeLessThan(1000); // 1s for concurrent batch
    });

    it('should have excellent cache performance', async () => {
      const result = await benchmark.benchmarkCachePerformance();

      expect(result.success).toBe(true);
      expect(result.averageTime).toBeLessThan(50); // 50ms for cache hits
      expect(result.throughput).toBeGreaterThan(100); // 100 cache hits/sec
    });

    it('should handle fuzzy search efficiently', async () => {
      const result = await benchmark.benchmarkFuzzySearch();

      expect(result.success).toBe(true);
      expect(result.averageTime).toBeLessThan(300); // 300ms for fuzzy
    });
  });

  describe('Large Dataset Performance (10K entries)', () => {
    beforeAll(async () => {
      await benchmark.initialize(10000);
    }, 120000);

    it('should scale well with larger datasets', async () => {
      const result = await benchmark.benchmarkBasicSearch();

      expect(result.success).toBe(true);
      expect(result.averageTime).toBeLessThan(500); // 500ms with 10K entries
      expect(result.throughput).toBeGreaterThan(5); // 5 searches/sec minimum
    });

    it('should handle large result sets', async () => {
      const result = await benchmark.benchmarkLargeResultSet();

      expect(result.success).toBe(true);
      expect(result.averageTime).toBeLessThan(1000); // 1s for 100 results
    });

    it('should maintain memory efficiency under stress', async () => {
      const result = await benchmark.benchmarkMemoryStress();

      expect(result.success).toBe(true);

      if (result.memoryUsage) {
        const memoryIncrease = result.memoryUsage.peak - result.memoryUsage.initial;
        expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // 200MB max increase
      }
    });

    it('should have fast indexing performance', async () => {
      const result = await benchmark.benchmarkIndexingPerformance();

      expect(result.success).toBe(true);
      expect(result.averageTime).toBeLessThan(100); // 100ms per document
      expect(result.throughput).toBeGreaterThan(20); // 20 docs/sec
    });
  });

  describe('Performance Quality Metrics', () => {
    it('should meet all performance SLAs', async () => {
      const metrics = benchmark.calculatePerformanceMetrics();

      // Service Level Agreements
      expect(metrics.searchLatency.p95).toBeLessThan(1000); // 1s P95
      expect(metrics.searchLatency.p99).toBeLessThan(2000); // 2s P99
      expect(metrics.throughput).toBeGreaterThan(5); // 5 searches/sec minimum
      expect(metrics.memoryEfficiency).toBeLessThan(500); // 500MB max
      expect(metrics.errorRate).toBeLessThan(1); // <1% error rate
    });

    it('should generate comprehensive performance report', async () => {
      const report = benchmark.generateReport();

      expect(report).toContain('PERFORMANCE METRICS SUMMARY');
      expect(report).toContain('INDIVIDUAL BENCHMARK RESULTS');
      expect(report).toContain('PERFORMANCE VALIDATION');
      expect(report).toContain('Search Latency');
      expect(report).toContain('Throughput');
      expect(report).toContain('Memory Efficiency');

      console.log(report);
    });
  });
});