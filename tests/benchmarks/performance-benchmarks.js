/**
 * Performance Benchmarks Suite
 * Comprehensive benchmarking for response time validation
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class PerformanceBenchmarks {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      iterations: config.iterations || 100,
      warmupIterations: config.warmupIterations || 10,
      concurrencyLevels: config.concurrencyLevels || [1, 5, 10, 25, 50],
      slaTarget: config.slaTarget || 1000, // 1 second
      percentileTarget: config.percentileTarget || 95,
      outputDir: config.outputDir || './benchmark-results',
      ...config
    };

    this.benchmarkResults = new Map();
    this.performanceObserver = null;
    this.setupPerformanceObserver();
  }

  /**
   * Setup performance observer for detailed metrics
   */
  setupPerformanceObserver() {
    this.performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.name.startsWith('benchmark-')) {
          console.log(`⏱️  ${entry.name}: ${entry.duration.toFixed(2)}ms`);
        }
      });
    });

    this.performanceObserver.observe({ entryTypes: ['measure'] });
  }

  /**
   * Run comprehensive benchmark suite
   */
  async runBenchmarkSuite() {
    console.log('🎯 Starting Performance Benchmark Suite');
    console.log(`Target: ${this.config.percentileTarget}% of requests < ${this.config.slaTarget}ms`);

    try {
      await this.ensureOutputDir();

      const suiteResults = {
        timestamp: new Date().toISOString(),
        config: this.config,
        benchmarks: {},
        summary: null,
        slaCompliance: null
      };

      // Core benchmark tests
      suiteResults.benchmarks.responseTime = await this.benchmarkResponseTimes();
      suiteResults.benchmarks.throughput = await this.benchmarkThroughput();
      suiteResults.benchmarks.concurrency = await this.benchmarkConcurrency();
      suiteResults.benchmarks.memory = await this.benchmarkMemoryUsage();
      suiteResults.benchmarks.caching = await this.benchmarkCaching();
      suiteResults.benchmarks.database = await this.benchmarkDatabaseOperations();
      suiteResults.benchmarks.api = await this.benchmarkApiEndpoints();

      // Generate comprehensive analysis
      suiteResults.summary = this.generateBenchmarkSummary(suiteResults.benchmarks);
      suiteResults.slaCompliance = this.analyzeSlaCompliance(suiteResults.benchmarks);
      suiteResults.recommendations = this.generateOptimizationRecommendations(suiteResults);

      // Save results
      await this.saveBenchmarkResults(suiteResults);

      console.log('✅ Benchmark suite completed successfully');
      return suiteResults;

    } catch (error) {
      console.error('❌ Benchmark suite failed:', error);
      throw error;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Benchmark response times across different scenarios
   */
  async benchmarkResponseTimes() {
    console.log('⏱️  Benchmarking Response Times...');

    const scenarios = [
      { name: 'simple-search', endpoint: '/api/search', params: { q: 'test' } },
      { name: 'complex-search', endpoint: '/api/search', params: { q: 'complex query with filters', category: 'tech', sort: 'relevance' } },
      { name: 'entry-detail', endpoint: '/api/entries/1', params: {} },
      { name: 'category-list', endpoint: '/api/categories', params: {} },
      { name: 'paginated-results', endpoint: '/api/entries', params: { page: 2, limit: 20 } }
    ];

    const results = {};

    for (const scenario of scenarios) {
      console.log(`  Testing scenario: ${scenario.name}`);

      performance.mark(`${scenario.name}-start`);

      const scenarioResults = await this.benchmarkScenario(scenario);

      performance.mark(`${scenario.name}-end`);
      performance.measure(`benchmark-${scenario.name}`, `${scenario.name}-start`, `${scenario.name}-end`);

      results[scenario.name] = scenarioResults;
    }

    return results;
  }

  /**
   * Benchmark single scenario
   */
  async benchmarkScenario(scenario) {
    const results = {
      scenario: scenario.name,
      endpoint: scenario.endpoint,
      iterations: this.config.iterations,
      warmupIterations: this.config.warmupIterations,
      measurements: [],
      statistics: {}
    };

    // Warmup phase
    console.log(`    Warming up (${this.config.warmupIterations} iterations)...`);
    for (let i = 0; i < this.config.warmupIterations; i++) {
      try {
        await this.makeRequest(scenario.endpoint, scenario.params);
      } catch (error) {
        console.warn(`    Warmup request failed: ${error.message}`);
      }
    }

    // Benchmark phase
    console.log(`    Running benchmark (${this.config.iterations} iterations)...`);
    for (let i = 0; i < this.config.iterations; i++) {
      const measurement = await this.measureRequest(scenario.endpoint, scenario.params, i);
      results.measurements.push(measurement);

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write('.');
      }
    }
    console.log(); // New line after progress dots

    // Calculate statistics
    results.statistics = this.calculateStatistics(results.measurements);

    console.log(`    Results: avg=${results.statistics.mean.toFixed(2)}ms, p95=${results.statistics.percentiles.p95.toFixed(2)}ms`);

    return results;
  }

  /**
   * Measure single request with detailed metrics
   */
  async measureRequest(endpoint, params, iteration) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    try {
      const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
        params,
        timeout: 10000,
        validateStatus: () => true // Accept all status codes for measurement
      });

      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      return {
        iteration,
        responseTime: endTime - startTime,
        status: response.status,
        success: response.status >= 200 && response.status < 300,
        contentLength: response.headers['content-length'] || 0,
        memoryDelta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          external: endMemory.external - startMemory.external
        },
        timestamp: Date.now()
      };

    } catch (error) {
      const endTime = performance.now();

      return {
        iteration,
        responseTime: endTime - startTime,
        status: 0,
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Benchmark throughput at different concurrency levels
   */
  async benchmarkThroughput() {
    console.log('📊 Benchmarking Throughput...');

    const results = {};

    for (const concurrency of this.config.concurrencyLevels) {
      console.log(`  Testing concurrency level: ${concurrency}`);

      const concurrencyResult = await this.measureThroughputAtConcurrency(concurrency);
      results[`concurrency_${concurrency}`] = concurrencyResult;
    }

    return results;
  }

  /**
   * Measure throughput at specific concurrency level
   */
  async measureThroughputAtConcurrency(concurrency) {
    const duration = 30000; // 30 seconds
    const startTime = performance.now();
    const requests = [];

    // Create concurrent request streams
    const promises = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push(this.continuousRequestStream(i, duration, requests));
    }

    await Promise.all(promises);

    const endTime = performance.now();
    const actualDuration = endTime - startTime;

    // Analyze results
    const successfulRequests = requests.filter(req => req.success);
    const failedRequests = requests.filter(req => !req.success);

    return {
      concurrency,
      duration: actualDuration,
      totalRequests: requests.length,
      successfulRequests: successfulRequests.length,
      failedRequests: failedRequests.length,
      requestsPerSecond: (requests.length / actualDuration) * 1000,
      successfulRps: (successfulRequests.length / actualDuration) * 1000,
      averageResponseTime: successfulRequests.length > 0
        ? successfulRequests.reduce((sum, req) => sum + req.responseTime, 0) / successfulRequests.length
        : 0,
      percentiles: successfulRequests.length > 0
        ? this.calculatePercentiles(successfulRequests.map(req => req.responseTime))
        : {}
    };
  }

  /**
   * Continuous request stream for throughput testing
   */
  async continuousRequestStream(streamId, duration, results) {
    const startTime = performance.now();

    while (performance.now() - startTime < duration) {
      const result = await this.measureRequest('/api/search', { q: `stream-${streamId}` }, 0);
      results.push(result);

      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Benchmark concurrency scaling
   */
  async benchmarkConcurrency() {
    console.log('🔄 Benchmarking Concurrency Scaling...');

    const concurrencyLevels = [1, 2, 4, 8, 16, 32, 64, 100];
    const results = {};

    for (const level of concurrencyLevels) {
      console.log(`  Testing ${level} concurrent requests...`);

      const promises = [];
      const startTime = performance.now();

      for (let i = 0; i < level; i++) {
        promises.push(this.makeRequest('/api/search', { q: `concurrent-${i}` }));
      }

      try {
        const responses = await Promise.all(promises);
        const endTime = performance.now();

        const responseTimes = responses.map(r => r.responseTime);
        const totalTime = endTime - startTime;

        results[`level_${level}`] = {
          concurrency: level,
          totalTime,
          responses: responseTimes,
          statistics: this.calculateStatistics(responseTimes),
          throughput: (level / totalTime) * 1000
        };

      } catch (error) {
        results[`level_${level}`] = {
          concurrency: level,
          error: error.message
        };
      }
    }

    return results;
  }

  /**
   * Benchmark memory usage during operations
   */
  async benchmarkMemoryUsage() {
    console.log('💾 Benchmarking Memory Usage...');

    const memorySnapshots = [];
    const operations = [
      { name: 'baseline', action: () => Promise.resolve() },
      { name: 'simple-search', action: () => this.makeRequest('/api/search', { q: 'memory test' }) },
      { name: 'large-result-set', action: () => this.makeRequest('/api/entries', { limit: 100 }) },
      { name: 'concurrent-requests', action: () => Promise.all([
        this.makeRequest('/api/search', { q: 'test1' }),
        this.makeRequest('/api/search', { q: 'test2' }),
        this.makeRequest('/api/search', { q: 'test3' })
      ])}
    ];

    for (const operation of operations) {
      console.log(`  Testing memory usage: ${operation.name}`);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryBefore = process.memoryUsage();

      const startTime = performance.now();
      await operation.action();
      const endTime = performance.now();

      const memoryAfter = process.memoryUsage();

      memorySnapshots.push({
        operation: operation.name,
        duration: endTime - startTime,
        memoryBefore,
        memoryAfter,
        memoryDelta: {
          rss: memoryAfter.rss - memoryBefore.rss,
          heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
          heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
          external: memoryAfter.external - memoryBefore.external
        }
      });

      // Wait for memory to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return { snapshots: memorySnapshots };
  }

  /**
   * Benchmark caching effectiveness
   */
  async benchmarkCaching() {
    console.log('🗄️  Benchmarking Cache Effectiveness...');

    const cacheTests = [
      { name: 'first-request', query: 'cache-benchmark-unique-query' },
      { name: 'immediate-repeat', query: 'cache-benchmark-unique-query' },
      { name: 'after-delay', query: 'cache-benchmark-unique-query', delay: 5000 }
    ];

    const results = {};

    for (const test of cacheTests) {
      console.log(`  Testing: ${test.name}`);

      if (test.delay) {
        await new Promise(resolve => setTimeout(resolve, test.delay));
      }

      const measurement = await this.measureRequest('/api/search', { q: test.query }, 0);
      results[test.name] = measurement;
    }

    // Calculate cache effectiveness
    const firstRequest = results['first-request'];
    const cachedRequest = results['immediate-repeat'];

    if (firstRequest && cachedRequest) {
      const improvement = ((firstRequest.responseTime - cachedRequest.responseTime) / firstRequest.responseTime) * 100;
      results.cacheEffectiveness = {
        improvementPercentage: improvement,
        firstRequestTime: firstRequest.responseTime,
        cachedRequestTime: cachedRequest.responseTime,
        isCacheEffective: improvement > 20 // 20% improvement threshold
      };
    }

    return results;
  }

  /**
   * Benchmark database operations
   */
  async benchmarkDatabaseOperations() {
    console.log('🗃️  Benchmarking Database Operations...');

    const dbOperations = [
      { name: 'search-query', endpoint: '/api/search', params: { q: 'database benchmark' } },
      { name: 'entry-retrieval', endpoint: '/api/entries/1', params: {} },
      { name: 'list-pagination', endpoint: '/api/entries', params: { page: 1, limit: 50 } },
      { name: 'category-listing', endpoint: '/api/categories', params: {} }
    ];

    const results = {};

    for (const operation of dbOperations) {
      console.log(`  Testing database operation: ${operation.name}`);

      const operationResults = [];

      for (let i = 0; i < 20; i++) {
        const measurement = await this.measureRequest(operation.endpoint, operation.params, i);
        operationResults.push(measurement);
      }

      results[operation.name] = {
        measurements: operationResults,
        statistics: this.calculateStatistics(operationResults.map(r => r.responseTime))
      };
    }

    return results;
  }

  /**
   * Benchmark API endpoints comprehensively
   */
  async benchmarkApiEndpoints() {
    console.log('🌐 Benchmarking API Endpoints...');

    const endpoints = [
      { name: 'health-check', path: '/api/health', method: 'GET' },
      { name: 'search-basic', path: '/api/search', method: 'GET', params: { q: 'test' } },
      { name: 'search-complex', path: '/api/search', method: 'GET', params: { q: 'complex query', category: 'tech', sort: 'date' } },
      { name: 'entries-list', path: '/api/entries', method: 'GET', params: { limit: 20 } },
      { name: 'entry-detail', path: '/api/entries/1', method: 'GET' },
      { name: 'categories', path: '/api/categories', method: 'GET' }
    ];

    const results = {};

    for (const endpoint of endpoints) {
      console.log(`  Benchmarking endpoint: ${endpoint.name}`);

      const endpointResults = [];

      for (let i = 0; i < 50; i++) {
        const measurement = await this.measureRequest(endpoint.path, endpoint.params || {}, i);
        endpointResults.push(measurement);
      }

      const statistics = this.calculateStatistics(endpointResults.map(r => r.responseTime));
      const successRate = (endpointResults.filter(r => r.success).length / endpointResults.length) * 100;

      results[endpoint.name] = {
        endpoint: endpoint.path,
        method: endpoint.method,
        measurements: endpointResults.length,
        statistics,
        successRate,
        slaCompliant: statistics.percentiles.p95 < this.config.slaTarget
      };
    }

    return results;
  }

  /**
   * Make HTTP request and measure response
   */
  async makeRequest(endpoint, params = {}) {
    const startTime = performance.now();

    try {
      const response = await axios.get(`${this.config.baseUrl}${endpoint}`, {
        params,
        timeout: 10000
      });

      const endTime = performance.now();

      return {
        responseTime: endTime - startTime,
        status: response.status,
        success: true,
        contentLength: response.data ? JSON.stringify(response.data).length : 0
      };

    } catch (error) {
      const endTime = performance.now();

      return {
        responseTime: endTime - startTime,
        status: error.response?.status || 0,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate comprehensive statistics
   */
  calculateStatistics(measurements) {
    if (measurements.length === 0) {
      return { error: 'No measurements available' };
    }

    const validMeasurements = measurements.filter(m => typeof m === 'number' && !isNaN(m));

    if (validMeasurements.length === 0) {
      return { error: 'No valid measurements' };
    }

    const sorted = validMeasurements.sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      median: this.calculateMedian(sorted),
      stdDev: this.calculateStandardDeviation(sorted, sum / sorted.length),
      percentiles: this.calculatePercentiles(sorted),
      variance: this.calculateVariance(sorted, sum / sorted.length)
    };
  }

  /**
   * Calculate median
   */
  calculateMedian(sortedArray) {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
      : sortedArray[mid];
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values, mean) {
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Calculate variance
   */
  calculateVariance(values, mean) {
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    return squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate percentiles
   */
  calculatePercentiles(sortedArray) {
    const percentiles = {};
    const levels = [25, 50, 75, 90, 95, 99, 99.9];

    levels.forEach(p => {
      const index = Math.ceil((p / 100) * sortedArray.length) - 1;
      percentiles[`p${p}`] = sortedArray[Math.max(0, index)];
    });

    return percentiles;
  }

  /**
   * Generate benchmark summary
   */
  generateBenchmarkSummary(benchmarks) {
    console.log('📋 Generating benchmark summary...');

    const summary = {
      overallPerformance: 'unknown',
      keyMetrics: {},
      performanceGrade: 'F',
      issues: [],
      strengths: []
    };

    // Analyze response time benchmarks
    if (benchmarks.responseTime) {
      const responseTimeResults = Object.values(benchmarks.responseTime);
      const avgP95 = responseTimeResults.reduce((sum, result) => sum + result.statistics.percentiles.p95, 0) / responseTimeResults.length;

      summary.keyMetrics.averageP95ResponseTime = avgP95;
      summary.keyMetrics.slaCompliant = avgP95 < this.config.slaTarget;

      if (avgP95 < this.config.slaTarget) {
        summary.strengths.push('Response times meet SLA target');
      } else {
        summary.issues.push(`Average P95 response time (${avgP95.toFixed(2)}ms) exceeds SLA target (${this.config.slaTarget}ms)`);
      }
    }

    // Analyze throughput
    if (benchmarks.throughput) {
      const maxThroughput = Math.max(...Object.values(benchmarks.throughput).map(t => t.requestsPerSecond));
      summary.keyMetrics.maxThroughput = maxThroughput;

      if (maxThroughput > 100) {
        summary.strengths.push('Good throughput capacity');
      } else {
        summary.issues.push('Low throughput capacity');
      }
    }

    // Calculate performance grade
    summary.performanceGrade = this.calculatePerformanceGrade(summary.keyMetrics, summary.issues.length);

    return summary;
  }

  /**
   * Analyze SLA compliance
   */
  analyzeSlaCompliance(benchmarks) {
    console.log('✅ Analyzing SLA compliance...');

    const compliance = {
      overall: true,
      details: {},
      compliancePercentage: 0,
      violations: []
    };

    let totalTests = 0;
    let compliantTests = 0;

    // Check each benchmark category
    Object.entries(benchmarks).forEach(([category, results]) => {
      if (typeof results === 'object' && results !== null) {
        Object.entries(results).forEach(([testName, testResult]) => {
          if (testResult.statistics && testResult.statistics.percentiles) {
            totalTests++;
            const p95Time = testResult.statistics.percentiles.p95;
            const isCompliant = p95Time < this.config.slaTarget;

            if (isCompliant) {
              compliantTests++;
            } else {
              compliance.violations.push({
                category,
                test: testName,
                p95Time,
                target: this.config.slaTarget,
                excess: p95Time - this.config.slaTarget
              });
            }

            compliance.details[`${category}.${testName}`] = {
              compliant: isCompliant,
              p95Time,
              target: this.config.slaTarget
            };
          }
        });
      }
    });

    compliance.compliancePercentage = totalTests > 0 ? (compliantTests / totalTests) * 100 : 0;
    compliance.overall = compliance.compliancePercentage >= 95; // 95% compliance threshold

    return compliance;
  }

  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations(results) {
    const recommendations = [];

    // Response time recommendations
    if (results.slaCompliance && !results.slaCompliance.overall) {
      recommendations.push({
        category: 'Performance',
        priority: 'High',
        recommendation: 'Response times exceed SLA targets. Consider implementing caching, query optimization, or scaling infrastructure.'
      });
    }

    // Cache effectiveness recommendations
    if (results.benchmarks.caching?.cacheEffectiveness?.improvementPercentage < 20) {
      recommendations.push({
        category: 'Caching',
        priority: 'Medium',
        recommendation: 'Cache effectiveness is low. Review cache strategy, TTL settings, and cache invalidation logic.'
      });
    }

    // Throughput recommendations
    if (results.summary?.keyMetrics?.maxThroughput < 50) {
      recommendations.push({
        category: 'Scalability',
        priority: 'High',
        recommendation: 'Low throughput detected. Consider horizontal scaling, connection pooling, or load balancing.'
      });
    }

    return recommendations;
  }

  /**
   * Calculate performance grade
   */
  calculatePerformanceGrade(metrics, issueCount) {
    let score = 100;

    // Deduct points for SLA violations
    if (!metrics.slaCompliant) {
      score -= 30;
    }

    // Deduct points for low throughput
    if (metrics.maxThroughput < 50) {
      score -= 20;
    }

    // Deduct points for each issue
    score -= issueCount * 10;

    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Save benchmark results
   */
  async saveBenchmarkResults(results) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-benchmarks-${timestamp}.json`;
    const filepath = path.join(this.config.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    console.log(`📄 Benchmark results saved to: ${filepath}`);
  }

  /**
   * Ensure output directory exists
   */
  async ensureOutputDir() {
    try {
      await fs.access(this.config.outputDir);
    } catch {
      await fs.mkdir(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
  }
}

module.exports = PerformanceBenchmarks;