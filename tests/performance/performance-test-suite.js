/**
 * Comprehensive Performance Test Suite
 * Validates <1s response times and SLA compliance
 */

const { performance } = require('perf_hooks');
const axios = require('axios');
const cluster = require('cluster');
const os = require('os');

class PerformanceTestSuite {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      slaTarget: config.slaTarget || 1000, // 1 second
      percentile: config.percentile || 95,
      warmupRequests: config.warmupRequests || 10,
      testDuration: config.testDuration || 60000, // 1 minute
      maxConcurrency: config.maxConcurrency || 100,
      ...config
    };

    this.metrics = {
      responses: [],
      errors: [],
      throughput: 0,
      averageResponseTime: 0,
      percentiles: {},
      slaCompliance: 0
    };
  }

  /**
   * Execute comprehensive performance validation
   */
  async runComprehensiveTest() {
    console.log('🚀 Starting Comprehensive Performance Test Suite');
    console.log(`Target: ${this.config.percentile}% of requests < ${this.config.slaTarget}ms`);

    const results = {
      timestamp: new Date().toISOString(),
      config: this.config,
      tests: {}
    };

    try {
      // Warmup phase
      await this.warmupPhase();

      // Core performance tests
      results.tests.loadTest = await this.runLoadTest();
      results.tests.stressTest = await this.runStressTest();
      results.tests.spikeTest = await this.runSpikeTest();
      results.tests.enduranceTest = await this.runEnduranceTest();
      results.tests.cacheEffectivenessTest = await this.runCacheEffectivenessTest();

      // SLA validation
      results.slaValidation = this.validateSLA(results.tests);

      // Generate summary
      results.summary = this.generateSummary(results);

      return results;
    } catch (error) {
      console.error('❌ Performance test suite failed:', error);
      throw error;
    }
  }

  /**
   * Warmup phase to stabilize performance
   */
  async warmupPhase() {
    console.log('🔥 Warming up application...');

    for (let i = 0; i < this.config.warmupRequests; i++) {
      try {
        await this.makeRequest('/api/health');
      } catch (error) {
        // Ignore warmup errors
      }
    }

    // Wait for JIT optimization
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Warmup completed');
  }

  /**
   * Load testing with realistic patterns
   */
  async runLoadTest() {
    console.log('📊 Running Load Test...');

    const testPatterns = [
      { endpoint: '/api/search', weight: 40, params: { q: 'performance', limit: 20 } },
      { endpoint: '/api/entries', weight: 30, params: { page: 1, limit: 10 } },
      { endpoint: '/api/entries/:id', weight: 20, params: {} },
      { endpoint: '/api/categories', weight: 10, params: {} }
    ];

    const concurrencyLevels = [10, 25, 50, 75, 100];
    const results = {};

    for (const concurrency of concurrencyLevels) {
      console.log(`  Testing with ${concurrency} concurrent users...`);

      const startTime = performance.now();
      const promises = [];

      for (let i = 0; i < concurrency; i++) {
        promises.push(this.runUserPattern(testPatterns, 60000)); // 1 minute
      }

      const userResults = await Promise.all(promises);
      const endTime = performance.now();

      results[`concurrency_${concurrency}`] = this.analyzeResults(userResults, endTime - startTime);
    }

    return results;
  }

  /**
   * Stress testing for peak loads
   */
  async runStressTest() {
    console.log('💪 Running Stress Test...');

    const maxConcurrency = this.config.maxConcurrency;
    const rampUpTime = 30000; // 30 seconds
    const peakTime = 60000; // 1 minute
    const rampDownTime = 30000; // 30 seconds

    const results = {};

    // Ramp up phase
    console.log('  Ramping up load...');
    const rampUpResults = await this.rampUpLoad(maxConcurrency, rampUpTime);
    results.rampUp = rampUpResults;

    // Peak load phase
    console.log('  Peak load testing...');
    const peakResults = await this.sustainedLoad(maxConcurrency, peakTime);
    results.peak = peakResults;

    // Check for breaking point
    console.log('  Finding breaking point...');
    const breakingPoint = await this.findBreakingPoint(maxConcurrency);
    results.breakingPoint = breakingPoint;

    return results;
  }

  /**
   * Spike testing for sudden load increases
   */
  async runSpikeTest() {
    console.log('⚡ Running Spike Test...');

    const baseLoad = 10;
    const spikeLoad = 200;
    const spikeDuration = 10000; // 10 seconds

    // Baseline
    console.log('  Establishing baseline...');
    const baseline = await this.sustainedLoad(baseLoad, 30000);

    // Spike
    console.log('  Executing spike...');
    const spike = await this.sustainedLoad(spikeLoad, spikeDuration);

    // Recovery
    console.log('  Testing recovery...');
    const recovery = await this.sustainedLoad(baseLoad, 30000);

    return { baseline, spike, recovery };
  }

  /**
   * Endurance testing for long-term stability
   */
  async runEnduranceTest() {
    console.log('🏃 Running Endurance Test...');

    const concurrency = 25;
    const duration = 300000; // 5 minutes
    const intervals = 10;
    const intervalDuration = duration / intervals;

    const results = [];

    for (let i = 0; i < intervals; i++) {
      console.log(`  Interval ${i + 1}/${intervals}...`);

      const intervalResult = await this.sustainedLoad(concurrency, intervalDuration);
      intervalResult.interval = i + 1;
      intervalResult.timestamp = new Date().toISOString();

      results.push(intervalResult);

      // Brief pause between intervals
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return this.analyzeEnduranceResults(results);
  }

  /**
   * Cache effectiveness validation
   */
  async runCacheEffectivenessTest() {
    console.log('💾 Running Cache Effectiveness Test...');

    const testEndpoint = '/api/search';
    const testQuery = 'cache-test-query';
    const concurrency = 50;
    const repetitions = 10;

    const results = {
      firstRequest: null,
      cachedRequests: [],
      cacheHitRatio: 0,
      performanceImprovement: 0
    };

    // First request (cache miss)
    console.log('  Testing cache miss...');
    const firstRequestTime = await this.measureRequest(testEndpoint, { q: testQuery });
    results.firstRequest = firstRequestTime;

    // Subsequent requests (should be cached)
    console.log('  Testing cache hits...');
    for (let i = 0; i < repetitions; i++) {
      const promises = [];
      for (let j = 0; j < concurrency; j++) {
        promises.push(this.measureRequest(testEndpoint, { q: testQuery }));
      }

      const times = await Promise.all(promises);
      results.cachedRequests.push(...times);
    }

    // Analyze cache effectiveness
    const avgCachedTime = results.cachedRequests.reduce((sum, time) => sum + time, 0) / results.cachedRequests.length;
    results.performanceImprovement = ((firstRequestTime - avgCachedTime) / firstRequestTime) * 100;

    // Estimate cache hit ratio based on response times
    const fastResponses = results.cachedRequests.filter(time => time < firstRequestTime * 0.5).length;
    results.cacheHitRatio = (fastResponses / results.cachedRequests.length) * 100;

    return results;
  }

  /**
   * SLA validation
   */
  validateSLA(testResults) {
    console.log('📊 Validating SLA Compliance...');

    const allResponses = [];

    // Collect all response times from all tests
    Object.values(testResults).forEach(testResult => {
      if (testResult.responses) {
        allResponses.push(...testResult.responses);
      } else if (typeof testResult === 'object') {
        Object.values(testResult).forEach(subResult => {
          if (subResult.responses) {
            allResponses.push(...subResult.responses);
          }
        });
      }
    });

    if (allResponses.length === 0) {
      return { compliance: 0, error: 'No response data found' };
    }

    // Calculate percentiles
    const sortedResponses = allResponses.sort((a, b) => a - b);
    const percentiles = this.calculatePercentiles(sortedResponses);

    // Check SLA compliance
    const targetPercentile = percentiles[this.config.percentile];
    const compliance = targetPercentile <= this.config.slaTarget;
    const compliancePercentage = (sortedResponses.filter(time => time <= this.config.slaTarget).length / sortedResponses.length) * 100;

    return {
      compliance,
      compliancePercentage,
      targetPercentile,
      slaTarget: this.config.slaTarget,
      percentiles,
      totalRequests: allResponses.length,
      averageResponseTime: allResponses.reduce((sum, time) => sum + time, 0) / allResponses.length
    };
  }

  /**
   * Make HTTP request and measure response time
   */
  async makeRequest(endpoint, params = {}) {
    const startTime = performance.now();

    try {
      const url = `${this.config.baseUrl}${endpoint}`;
      const response = await axios.get(url, { params, timeout: 5000 });
      const endTime = performance.now();

      return {
        responseTime: endTime - startTime,
        status: response.status,
        success: true
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
   * Measure single request response time
   */
  async measureRequest(endpoint, params = {}) {
    const result = await this.makeRequest(endpoint, params);
    return result.responseTime;
  }

  /**
   * Run user pattern simulation
   */
  async runUserPattern(patterns, duration) {
    const responses = [];
    const errors = [];
    const startTime = performance.now();

    while (performance.now() - startTime < duration) {
      // Select random pattern based on weight
      const pattern = this.selectWeightedPattern(patterns);

      try {
        const result = await this.makeRequest(pattern.endpoint, pattern.params);
        responses.push(result.responseTime);

        if (!result.success) {
          errors.push(result);
        }
      } catch (error) {
        errors.push({ error: error.message, endpoint: pattern.endpoint });
      }

      // Random think time between requests (100-500ms)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100));
    }

    return { responses, errors };
  }

  /**
   * Select pattern based on weight
   */
  selectWeightedPattern(patterns) {
    const totalWeight = patterns.reduce((sum, pattern) => sum + pattern.weight, 0);
    let random = Math.random() * totalWeight;

    for (const pattern of patterns) {
      random -= pattern.weight;
      if (random <= 0) {
        return pattern;
      }
    }

    return patterns[0]; // Fallback
  }

  /**
   * Ramp up load gradually
   */
  async rampUpLoad(targetConcurrency, duration) {
    const intervals = 10;
    const intervalDuration = duration / intervals;
    const concurrencyStep = targetConcurrency / intervals;

    const results = [];

    for (let i = 1; i <= intervals; i++) {
      const concurrency = Math.floor(concurrencyStep * i);
      console.log(`    Ramp up: ${concurrency} users`);

      const result = await this.sustainedLoad(concurrency, intervalDuration);
      result.concurrency = concurrency;
      results.push(result);
    }

    return results;
  }

  /**
   * Sustained load testing
   */
  async sustainedLoad(concurrency, duration) {
    const promises = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(this.runUserPattern([
        { endpoint: '/api/search', weight: 100, params: { q: 'test' } }
      ], duration));
    }

    const results = await Promise.all(promises);
    return this.analyzeResults(results, duration);
  }

  /**
   * Find breaking point
   */
  async findBreakingPoint(startConcurrency) {
    let concurrency = startConcurrency;
    let previousSuccessRate = 100;

    const breakingPointThreshold = 90; // 90% success rate
    const testDuration = 30000; // 30 seconds

    while (concurrency <= 500) { // Safety limit
      console.log(`    Testing breaking point at ${concurrency} users...`);

      const result = await this.sustainedLoad(concurrency, testDuration);
      const successRate = ((result.totalRequests - result.errorCount) / result.totalRequests) * 100;

      if (successRate < breakingPointThreshold) {
        return {
          breakingPoint: concurrency,
          successRate,
          previousConcurrency: concurrency - 50,
          previousSuccessRate,
          result
        };
      }

      previousSuccessRate = successRate;
      concurrency += 50;
    }

    return {
      breakingPoint: null,
      message: 'Breaking point not found within safety limits'
    };
  }

  /**
   * Analyze test results
   */
  analyzeResults(userResults, duration) {
    const allResponses = userResults.flatMap(result => result.responses);
    const allErrors = userResults.flatMap(result => result.errors);

    if (allResponses.length === 0) {
      return {
        errorCount: allErrors.length,
        totalRequests: 0,
        throughput: 0,
        averageResponseTime: 0,
        percentiles: {},
        errors: allErrors
      };
    }

    const sortedResponses = allResponses.sort((a, b) => a - b);
    const percentiles = this.calculatePercentiles(sortedResponses);

    return {
      totalRequests: allResponses.length,
      errorCount: allErrors.length,
      successRate: ((allResponses.length - allErrors.length) / allResponses.length) * 100,
      throughput: (allResponses.length / duration) * 1000, // requests per second
      averageResponseTime: allResponses.reduce((sum, time) => sum + time, 0) / allResponses.length,
      percentiles,
      responses: sortedResponses,
      errors: allErrors,
      duration
    };
  }

  /**
   * Analyze endurance test results
   */
  analyzeEnduranceResults(intervals) {
    const degradation = [];
    const baselineAvg = intervals[0].averageResponseTime;

    intervals.forEach((interval, index) => {
      const degradationPercent = ((interval.averageResponseTime - baselineAvg) / baselineAvg) * 100;
      degradation.push({
        interval: index + 1,
        averageResponseTime: interval.averageResponseTime,
        degradation: degradationPercent,
        throughput: interval.throughput,
        errorCount: interval.errorCount
      });
    });

    const totalDegradation = degradation[degradation.length - 1].degradation;
    const maxDegradation = Math.max(...degradation.map(d => d.degradation));

    return {
      intervals: degradation,
      totalDegradation,
      maxDegradation,
      stable: maxDegradation < 20, // Consider stable if < 20% degradation
      summary: {
        baselineAvg,
        finalAvg: intervals[intervals.length - 1].averageResponseTime,
        totalRequests: intervals.reduce((sum, interval) => sum + interval.totalRequests, 0),
        totalErrors: intervals.reduce((sum, interval) => sum + interval.errorCount, 0)
      }
    };
  }

  /**
   * Calculate percentiles
   */
  calculatePercentiles(sortedArray) {
    const percentiles = {};
    const levels = [50, 75, 90, 95, 99, 99.9];

    levels.forEach(p => {
      const index = Math.ceil((p / 100) * sortedArray.length) - 1;
      percentiles[p] = sortedArray[Math.max(0, index)];
    });

    return percentiles;
  }

  /**
   * Generate test summary
   */
  generateSummary(results) {
    const sla = results.slaValidation;

    return {
      slaCompliant: sla.compliance,
      compliancePercentage: sla.compliancePercentage,
      overallGrade: this.calculateGrade(sla.compliancePercentage),
      recommendations: this.generateRecommendations(results),
      keyMetrics: {
        averageResponseTime: sla.averageResponseTime,
        p95ResponseTime: sla.percentiles[95],
        totalRequests: sla.totalRequests,
        slaTarget: sla.slaTarget
      }
    };
  }

  /**
   * Calculate performance grade
   */
  calculateGrade(compliancePercentage) {
    if (compliancePercentage >= 99) return 'A+';
    if (compliancePercentage >= 95) return 'A';
    if (compliancePercentage >= 90) return 'B';
    if (compliancePercentage >= 80) return 'C';
    if (compliancePercentage >= 70) return 'D';
    return 'F';
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(results) {
    const recommendations = [];
    const sla = results.slaValidation;

    if (!sla.compliance) {
      recommendations.push(`SLA target missed: ${sla.percentiles[95].toFixed(2)}ms > ${sla.slaTarget}ms at P95`);
    }

    if (sla.compliancePercentage < 95) {
      recommendations.push('Consider implementing caching strategies');
      recommendations.push('Optimize database queries and indexing');
      recommendations.push('Consider horizontal scaling');
    }

    if (results.tests.cacheEffectivenessTest?.performanceImprovement < 50) {
      recommendations.push('Cache effectiveness is low - review caching strategy');
    }

    if (results.tests.stressTest?.breakingPoint?.breakingPoint < 100) {
      recommendations.push('Low breaking point detected - improve scalability');
    }

    return recommendations;
  }
}

module.exports = PerformanceTestSuite;