/**
 * SearchService Benchmark Tests
 * Comprehensive benchmarking for response time, throughput, and memory usage
 */

import { SearchService } from '../SearchService';
import { KBEntry, SearchOptions } from '../../types/services';
import { performance } from 'perf_hooks';

// Benchmark configuration
const BENCHMARK_CONFIG = {
  RESPONSE_TIME: {
    TARGET_MS: 1000,           // Target: <1s response time
    SAMPLES: 100,              // Number of samples for statistical significance
    WARMUP_ROUNDS: 10          // Warmup rounds to stabilize performance
  },
  THROUGHPUT: {
    DURATION_MS: 10000,        // 10 second test duration
    TARGET_QPS: 10,            // Target: minimum 10 queries per second
    CONCURRENT_USERS: 5        // Simulate concurrent users
  },
  MEMORY: {
    BASELINE_THRESHOLD_MB: 50, // Baseline memory threshold
    LEAK_THRESHOLD_MB: 100,    // Memory leak threshold
    STRESS_ITERATIONS: 1000    // Iterations for memory stress test
  },
  DATASETS: {
    SMALL: 100,                // Small dataset size
    MEDIUM: 500,               // Medium dataset size  
    LARGE: 2000                // Large dataset size
  }
};

interface BenchmarkResult {
  metric: string;
  value: number;
  unit: string;
  target?: number;
  passed: boolean;
  details?: any;
}

interface PerformanceStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
}

describe('SearchService Benchmark Tests', () => {
  let searchService: SearchService;
  let smallDataset: KBEntry[];
  let mediumDataset: KBEntry[];
  let largeDataset: KBEntry[];

  beforeAll(async () => {
    console.log('🏁 Initializing SearchService Benchmarks...');
    
    searchService = new SearchService();
    
    // Generate test datasets
    smallDataset = generateBenchmarkDataset(BENCHMARK_CONFIG.DATASETS.SMALL);
    mediumDataset = generateBenchmarkDataset(BENCHMARK_CONFIG.DATASETS.MEDIUM);
    largeDataset = generateBenchmarkDataset(BENCHMARK_CONFIG.DATASETS.LARGE);
    
    // Build search indexes
    await searchService.buildIndex(smallDataset);
    await searchService.buildIndex(mediumDataset);
    await searchService.buildIndex(largeDataset);
    
    console.log(`📊 Generated datasets: Small(${smallDataset.length}), Medium(${mediumDataset.length}), Large(${largeDataset.length})`);
  });

  function generateBenchmarkDataset(size: number): KBEntry[] {
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'System', 'Other'];
    const errorCodes = ['S0C7', 'S0C4', 'S013', 'U0778', 'IEF212I', 'WER027A', 'EDC8128I', 'SQLCODE', 'ASRA'];
    const components = ['COBOL', 'JCL', 'VSAM', 'DB2', 'CICS', 'IMS', 'Dataset', 'File', 'Program', 'Job'];
    const operations = ['Read', 'Write', 'Update', 'Delete', 'Open', 'Close', 'Allocate', 'Process', 'Execute', 'Submit'];
    
    return Array.from({ length: size }, (_, i) => ({
      id: `bench-${i}`,
      title: `${categories[i % categories.length]} ${errorCodes[i % errorCodes.length]} Error in ${components[i % components.length]}`,
      problem: `Benchmark entry ${i}: ${components[i % components.length]} ${operations[i % operations.length]} operation fails with ${errorCodes[i % errorCodes.length]} error. This entry contains detailed problem description with common mainframe error scenarios, troubleshooting steps, and diagnostic information for comprehensive testing of search performance and accuracy.`,
      solution: `Benchmark solution ${i}: Step 1: Check ${components[i % components.length]} configuration and settings. Step 2: Verify ${operations[i % operations.length]} permissions and access rights. Step 3: Review ${errorCodes[i % errorCodes.length]} error documentation and resolution procedures. Step 4: Monitor system resources and performance metrics. Step 5: Contact appropriate support team if issue persists.`,
      category: categories[i % categories.length] as any,
      tags: [
        `bench-${i}`,
        errorCodes[i % errorCodes.length].toLowerCase(),
        components[i % components.length].toLowerCase(),
        operations[i % operations.length].toLowerCase(),
        'benchmark',
        'performance',
        'test'
      ],
      created_at: new Date(Date.now() - (i * 86400000)),
      updated_at: new Date(Date.now() - (i * 43200000)),
      created_by: 'benchmark-generator',
      usage_count: Math.floor(Math.random() * 1000),
      success_count: Math.floor(Math.random() * 800),
      failure_count: Math.floor(Math.random() * 200),
      version: 1
    }));
  }

  function calculateStats(values: number[]): PerformanceStats {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev
    };
  }

  function getMemoryUsage(): number {
    return process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }

  async function warmupSearchService(): Promise<void> {
    console.log('🔥 Warming up search service...');
    for (let i = 0; i < BENCHMARK_CONFIG.RESPONSE_TIME.WARMUP_ROUNDS; i++) {
      await searchService.search(`warmup query ${i}`, smallDataset);
    }
  }

  describe('Response Time Benchmarks', () => {
    beforeAll(async () => {
      await warmupSearchService();
    });

    test('should meet <1s response time target for small dataset', async () => {
      console.log('⏱️  Benchmarking response time - Small Dataset');
      
      const measurements: number[] = [];
      const queries = [
        'error abend S0C7',
        'VSAM file not found',
        'JCL dataset allocation',
        'DB2 SQLCODE resource',
        'CICS transaction timeout'
      ];
      
      for (let i = 0; i < BENCHMARK_CONFIG.RESPONSE_TIME.SAMPLES; i++) {
        const query = queries[i % queries.length];
        const startTime = performance.now();
        
        await searchService.search(query, smallDataset);
        
        const duration = performance.now() - startTime;
        measurements.push(duration);
      }
      
      const stats = calculateStats(measurements);
      
      console.log(`📈 Small Dataset Response Time Stats:
        Mean: ${stats.mean.toFixed(2)}ms
        Median: ${stats.median.toFixed(2)}ms
        P95: ${stats.p95.toFixed(2)}ms
        P99: ${stats.p99.toFixed(2)}ms
        Max: ${stats.max.toFixed(2)}ms`);
      
      expect(stats.mean).toBeLessThan(BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS);
      expect(stats.p95).toBeLessThan(BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS);
      expect(stats.p99).toBeLessThan(BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS * 1.5);
    });

    test('should meet <1s response time target for medium dataset', async () => {
      console.log('⏱️  Benchmarking response time - Medium Dataset');
      
      const measurements: number[] = [];
      const complexQueries = [
        'complex error troubleshooting with multiple conditions',
        'system abend program check memory violation',
        'database resource unavailable deadlock timeout',
        'file allocation permission denied security',
        'transaction processing failure recovery'
      ];
      
      for (let i = 0; i < BENCHMARK_CONFIG.RESPONSE_TIME.SAMPLES; i++) {
        const query = complexQueries[i % complexQueries.length];
        const startTime = performance.now();
        
        await searchService.search(query, mediumDataset);
        
        const duration = performance.now() - startTime;
        measurements.push(duration);
      }
      
      const stats = calculateStats(measurements);
      
      console.log(`📈 Medium Dataset Response Time Stats:
        Mean: ${stats.mean.toFixed(2)}ms
        Median: ${stats.median.toFixed(2)}ms
        P95: ${stats.p95.toFixed(2)}ms
        P99: ${stats.p99.toFixed(2)}ms
        Max: ${stats.max.toFixed(2)}ms`);
      
      expect(stats.mean).toBeLessThan(BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS);
      expect(stats.p95).toBeLessThan(BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS * 1.2);
    });

    test('should meet <1s response time target for large dataset', async () => {
      console.log('⏱️  Benchmarking response time - Large Dataset');
      
      const measurements: number[] = [];
      const stressQueries = [
        'comprehensive mainframe troubleshooting guide',
        'performance optimization system analysis',
        'error pattern recognition and resolution',
        'automated diagnostic tool configuration',
        'enterprise monitoring solution deployment'
      ];
      
      for (let i = 0; i < Math.floor(BENCHMARK_CONFIG.RESPONSE_TIME.SAMPLES / 2); i++) {
        const query = stressQueries[i % stressQueries.length];
        const startTime = performance.now();
        
        await searchService.search(query, largeDataset);
        
        const duration = performance.now() - startTime;
        measurements.push(duration);
      }
      
      const stats = calculateStats(measurements);
      
      console.log(`📈 Large Dataset Response Time Stats:
        Mean: ${stats.mean.toFixed(2)}ms
        Median: ${stats.median.toFixed(2)}ms
        P95: ${stats.p95.toFixed(2)}ms
        P99: ${stats.p99.toFixed(2)}ms
        Max: ${stats.max.toFixed(2)}ms`);
      
      expect(stats.mean).toBeLessThan(BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS);
      expect(stats.p95).toBeLessThan(BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS * 1.5);
    });

    test('should maintain response time with complex options', async () => {
      console.log('⏱️  Benchmarking response time - Complex Options');
      
      const complexOptions: SearchOptions = {
        limit: 50,
        includeHighlights: true,
        sortBy: 'usage',
        threshold: 0.1,
        tags: ['error', 'abend']
      };
      
      const measurements: number[] = [];
      
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();
        
        await searchService.search(`complex options test ${i}`, mediumDataset, complexOptions);
        
        const duration = performance.now() - startTime;
        measurements.push(duration);
      }
      
      const stats = calculateStats(measurements);
      
      console.log(`📈 Complex Options Response Time Stats:
        Mean: ${stats.mean.toFixed(2)}ms
        P95: ${stats.p95.toFixed(2)}ms
        Max: ${stats.max.toFixed(2)}ms`);
      
      expect(stats.mean).toBeLessThan(BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS);
      expect(stats.p95).toBeLessThan(BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS * 1.3);
    });
  });

  describe('Throughput Benchmarks', () => {
    test('should achieve minimum throughput target', async () => {
      console.log('🚀 Benchmarking throughput - Sequential Load');
      
      const startTime = performance.now();
      let queryCount = 0;
      const queries = ['error', 'abend', 'status', 'exception', 'failure', 'timeout', 'resource'];
      
      while (performance.now() - startTime < BENCHMARK_CONFIG.THROUGHPUT.DURATION_MS) {
        const query = queries[queryCount % queries.length];
        await searchService.search(query, mediumDataset);
        queryCount++;
      }
      
      const actualDuration = (performance.now() - startTime) / 1000; // seconds
      const throughput = queryCount / actualDuration;
      
      console.log(`📊 Sequential Throughput: ${throughput.toFixed(2)} queries/second`);
      console.log(`📊 Total queries executed: ${queryCount}`);
      
      expect(throughput).toBeGreaterThan(BENCHMARK_CONFIG.THROUGHPUT.TARGET_QPS);
    });

    test('should handle concurrent load efficiently', async () => {
      console.log('🚀 Benchmarking throughput - Concurrent Load');
      
      const concurrentUsers = BENCHMARK_CONFIG.THROUGHPUT.CONCURRENT_USERS;
      const queriesPerUser = 20;
      const queries = [
        'VSAM error troubleshooting',
        'JCL allocation problem',
        'DB2 performance issue',
        'CICS transaction failure',
        'System abend recovery'
      ];
      
      const startTime = performance.now();
      
      const userPromises = Array.from({ length: concurrentUsers }, async (_, userIndex) => {
        const userQueries = Array.from({ length: queriesPerUser }, (_, queryIndex) => 
          `${queries[queryIndex % queries.length]} user${userIndex}`
        );
        
        for (const query of userQueries) {
          await searchService.search(query, mediumDataset);
        }
      });
      
      await Promise.all(userPromises);
      
      const duration = (performance.now() - startTime) / 1000;
      const totalQueries = concurrentUsers * queriesPerUser;
      const concurrentThroughput = totalQueries / duration;
      
      console.log(`📊 Concurrent Throughput: ${concurrentThroughput.toFixed(2)} queries/second`);
      console.log(`📊 Concurrent users: ${concurrentUsers}`);
      console.log(`📊 Total concurrent queries: ${totalQueries}`);
      
      expect(concurrentThroughput).toBeGreaterThan(BENCHMARK_CONFIG.THROUGHPUT.TARGET_QPS);
    });

    test('should scale throughput with parallel execution', async () => {
      console.log('🚀 Benchmarking throughput - Parallel Execution');
      
      const parallelQueries = 100;
      const queries = Array.from({ length: parallelQueries }, (_, i) => `parallel query ${i}`);
      
      const startTime = performance.now();
      
      const promises = queries.map(query => searchService.search(query, smallDataset));
      await Promise.all(promises);
      
      const duration = (performance.now() - startTime) / 1000;
      const parallelThroughput = parallelQueries / duration;
      
      console.log(`📊 Parallel Throughput: ${parallelThroughput.toFixed(2)} queries/second`);
      console.log(`📊 Parallel queries: ${parallelQueries}`);
      
      expect(parallelThroughput).toBeGreaterThan(BENCHMARK_CONFIG.THROUGHPUT.TARGET_QPS * 2);
    });
  });

  describe('Memory Usage Benchmarks', () => {
    test('should maintain reasonable memory usage', async () => {
      console.log('💾 Benchmarking memory usage - Normal Load');
      
      const initialMemory = getMemoryUsage();
      console.log(`🔍 Initial memory usage: ${initialMemory.toFixed(2)} MB`);
      
      // Perform normal search operations
      for (let i = 0; i < 100; i++) {
        await searchService.search(`memory test ${i}`, mediumDataset);
      }
      
      const afterSearchMemory = getMemoryUsage();
      const memoryIncrease = afterSearchMemory - initialMemory;
      
      console.log(`🔍 Memory after searches: ${afterSearchMemory.toFixed(2)} MB`);
      console.log(`🔍 Memory increase: ${memoryIncrease.toFixed(2)} MB`);
      
      expect(memoryIncrease).toBeLessThan(BENCHMARK_CONFIG.MEMORY.BASELINE_THRESHOLD_MB);
    });

    test('should not have memory leaks under stress', async () => {
      console.log('💾 Benchmarking memory usage - Stress Test');
      
      const initialMemory = getMemoryUsage();
      const memorySnapshots: number[] = [];
      
      for (let i = 0; i < BENCHMARK_CONFIG.MEMORY.STRESS_ITERATIONS; i++) {
        await searchService.search(`stress test ${i}`, largeDataset);
        
        // Take memory snapshots periodically
        if (i % 100 === 0) {
          const currentMemory = getMemoryUsage();
          memorySnapshots.push(currentMemory - initialMemory);
          
          console.log(`🔍 Memory snapshot ${i}: ${currentMemory.toFixed(2)} MB (+${(currentMemory - initialMemory).toFixed(2)} MB)`);
        }
      }
      
      // Check for memory leaks
      const finalMemory = getMemoryUsage();
      const totalMemoryIncrease = finalMemory - initialMemory;
      
      console.log(`🔍 Final memory usage: ${finalMemory.toFixed(2)} MB`);
      console.log(`🔍 Total memory increase: ${totalMemoryIncrease.toFixed(2)} MB`);
      
      // Memory increase should be reasonable
      expect(totalMemoryIncrease).toBeLessThan(BENCHMARK_CONFIG.MEMORY.LEAK_THRESHOLD_MB);
      
      // Memory should not continuously increase
      if (memorySnapshots.length > 2) {
        const firstHalf = memorySnapshots.slice(0, Math.floor(memorySnapshots.length / 2));
        const secondHalf = memorySnapshots.slice(Math.floor(memorySnapshots.length / 2));
        
        const firstHalfAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
        
        // Second half should not significantly exceed first half
        expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 2);
      }
    });

    test('should handle large result sets efficiently', async () => {
      console.log('💾 Benchmarking memory usage - Large Result Sets');
      
      const initialMemory = getMemoryUsage();
      
      // Search for common terms that return many results
      const largeResultQueries = ['error', 'benchmark', 'test', 'system', 'program'];
      
      for (const query of largeResultQueries) {
        const results = await searchService.search(query, largeDataset, { limit: 500 });
        console.log(`🔍 Query "${query}" returned ${results.length} results`);
      }
      
      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory - initialMemory;
      
      console.log(`🔍 Memory increase for large results: ${memoryIncrease.toFixed(2)} MB`);
      
      expect(memoryIncrease).toBeLessThan(BENCHMARK_CONFIG.MEMORY.BASELINE_THRESHOLD_MB);
    });
  });

  describe('Index Performance Benchmarks', () => {
    test('should build indexes efficiently', async () => {
      console.log('🏗️  Benchmarking index building performance');
      
      const indexSizes = [100, 500, 1000, 2000];
      const buildTimes: number[] = [];
      
      for (const size of indexSizes) {
        const dataset = generateBenchmarkDataset(size);
        
        const startTime = performance.now();
        await searchService.buildIndex(dataset);
        const buildTime = performance.now() - startTime;
        
        buildTimes.push(buildTime);
        console.log(`🔍 Index build time for ${size} entries: ${buildTime.toFixed(2)}ms`);
      }
      
      // Index build time should scale reasonably
      expect(buildTimes[buildTimes.length - 1]).toBeLessThan(5000); // <5s for largest index
    });

    test('should optimize indexes effectively', async () => {
      console.log('🏗️  Benchmarking index optimization');
      
      const startTime = performance.now();
      await searchService.optimizeIndex();
      const optimizeTime = performance.now() - startTime;
      
      console.log(`🔍 Index optimization time: ${optimizeTime.toFixed(2)}ms`);
      
      expect(optimizeTime).toBeLessThan(1000); // <1s for optimization
    });
  });

  describe('Comprehensive Performance Summary', () => {
    test('should generate performance benchmark report', async () => {
      console.log('📋 Generating comprehensive performance report...');
      
      const benchmarkResults: BenchmarkResult[] = [];
      
      // Response time benchmark
      const responseTimeStart = performance.now();
      await searchService.search('benchmark summary test', mediumDataset);
      const responseTime = performance.now() - responseTimeStart;
      
      benchmarkResults.push({
        metric: 'Response Time',
        value: responseTime,
        unit: 'ms',
        target: BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS,
        passed: responseTime < BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS
      });
      
      // Memory usage
      const memoryUsage = getMemoryUsage();
      benchmarkResults.push({
        metric: 'Memory Usage',
        value: memoryUsage,
        unit: 'MB',
        target: BENCHMARK_CONFIG.MEMORY.BASELINE_THRESHOLD_MB,
        passed: memoryUsage < BENCHMARK_CONFIG.MEMORY.BASELINE_THRESHOLD_MB
      });
      
      // Generate final report
      console.log('\n📊 PERFORMANCE BENCHMARK SUMMARY');
      console.log('================================');
      
      benchmarkResults.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        const target = result.target ? ` (target: <${result.target}${result.unit})` : '';
        console.log(`${status} ${result.metric}: ${result.value.toFixed(2)}${result.unit}${target}`);
      });
      
      console.log('\n📈 Dataset Information:');
      console.log(`   Small Dataset: ${smallDataset.length} entries`);
      console.log(`   Medium Dataset: ${mediumDataset.length} entries`);
      console.log(`   Large Dataset: ${largeDataset.length} entries`);
      
      console.log('\n🎯 Performance Targets:');
      console.log(`   Response Time: <${BENCHMARK_CONFIG.RESPONSE_TIME.TARGET_MS}ms`);
      console.log(`   Throughput: >${BENCHMARK_CONFIG.THROUGHPUT.TARGET_QPS} QPS`);
      console.log(`   Memory Usage: <${BENCHMARK_CONFIG.MEMORY.BASELINE_THRESHOLD_MB}MB increase`);
      
      // All critical benchmarks should pass
      const criticalBenchmarks = benchmarkResults.filter(r => r.metric === 'Response Time');
      criticalBenchmarks.forEach(benchmark => {
        expect(benchmark.passed).toBeTruthy();
      });
    });
  });
});