/**
 * Custom Jest Matchers for Performance Testing
 * Provides specialized assertions for performance validation
 */

const { performance } = require('perf_hooks');

// Custom matcher for response time assertions
expect.extend({
  /**
   * Assert response time is within SLA target
   */
  toBeWithinSLA(received, slaTarget = 1000) {
    const pass = received <= slaTarget;

    return {
      message: () => pass
        ? `Expected ${received}ms to exceed SLA target ${slaTarget}ms`
        : `Expected ${received}ms to be within SLA target ${slaTarget}ms`,
      pass
    };
  },

  /**
   * Assert response time is faster than baseline
   */
  toBeFasterThan(received, baseline) {
    const pass = received < baseline;
    const improvement = baseline - received;
    const improvementPercent = ((baseline - received) / baseline) * 100;

    return {
      message: () => pass
        ? `Expected ${received}ms not to be faster than baseline ${baseline}ms`
        : `Expected ${received}ms to be faster than baseline ${baseline}ms (actual: ${improvement.toFixed(2)}ms slower, ${improvementPercent.toFixed(2)}% degradation)`,
      pass
    };
  },

  /**
   * Assert throughput meets minimum requirement
   */
  toMeetThroughputTarget(received, target = 100) {
    const pass = received >= target;

    return {
      message: () => pass
        ? `Expected ${received} RPS not to meet throughput target ${target} RPS`
        : `Expected ${received} RPS to meet throughput target ${target} RPS (deficit: ${(target - received).toFixed(2)} RPS)`,
      pass
    };
  },

  /**
   * Assert error rate is within acceptable limits
   */
  toHaveAcceptableErrorRate(received, maxErrorRate = 1) {
    const pass = received <= maxErrorRate;

    return {
      message: () => pass
        ? `Expected ${received}% error rate to exceed acceptable limit ${maxErrorRate}%`
        : `Expected ${received}% error rate to be within acceptable limit ${maxErrorRate}% (excess: ${(received - maxErrorRate).toFixed(2)}%)`,
      pass
    };
  },

  /**
   * Assert availability meets SLA
   */
  toMeetAvailabilitySLA(received, slaTarget = 99.9) {
    const pass = received >= slaTarget;

    return {
      message: () => pass
        ? `Expected ${received}% availability not to meet SLA target ${slaTarget}%`
        : `Expected ${received}% availability to meet SLA target ${slaTarget}% (deficit: ${(slaTarget - received).toFixed(2)}%)`,
      pass
    };
  },

  /**
   * Assert percentile response time
   */
  toHavePercentileWithin(received, percentile, target) {
    const percentileValue = received[`p${percentile}`];
    const pass = percentileValue && percentileValue <= target;

    return {
      message: () => pass
        ? `Expected P${percentile} ${percentileValue}ms not to be within target ${target}ms`
        : `Expected P${percentile} ${percentileValue}ms to be within target ${target}ms`,
      pass
    };
  },

  /**
   * Assert no performance regression
   */
  toShowNoRegression(received, baseline, threshold = 20) {
    const regressionPercent = ((received - baseline) / baseline) * 100;
    const pass = regressionPercent <= threshold;

    return {
      message: () => pass
        ? `Expected ${received}ms not to show regression from baseline ${baseline}ms`
        : `Expected ${received}ms to show no regression from baseline ${baseline}ms (actual: ${regressionPercent.toFixed(2)}% regression, threshold: ${threshold}%)`,
      pass
    };
  },

  /**
   * Assert memory usage is within limits
   */
  toHaveMemoryUsageWithin(received, limit) {
    const pass = received <= limit;
    const limitMB = limit / (1024 * 1024);
    const receivedMB = received / (1024 * 1024);

    return {
      message: () => pass
        ? `Expected ${receivedMB.toFixed(2)}MB memory usage not to be within limit ${limitMB.toFixed(2)}MB`
        : `Expected ${receivedMB.toFixed(2)}MB memory usage to be within limit ${limitMB.toFixed(2)}MB (excess: ${(receivedMB - limitMB).toFixed(2)}MB)`,
      pass
    };
  },

  /**
   * Assert scalability characteristics
   */
  toScaleLinearly(received, expectedSlope = 1, tolerance = 0.2) {
    // received should be array of {load, metric} objects
    if (received.length < 2) {
      return {
        message: () => 'Insufficient data points for scalability analysis (minimum 2 required)',
        pass: false
      };
    }

    // Calculate actual slope using linear regression
    const n = received.length;
    const sumX = received.reduce((sum, point) => sum + point.load, 0);
    const sumY = received.reduce((sum, point) => sum + point.metric, 0);
    const sumXY = received.reduce((sum, point) => sum + (point.load * point.metric), 0);
    const sumXX = received.reduce((sum, point) => sum + (point.load * point.load), 0);

    const actualSlope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const slopeDifference = Math.abs(actualSlope - expectedSlope);
    const pass = slopeDifference <= tolerance;

    return {
      message: () => pass
        ? `Expected slope ${actualSlope.toFixed(3)} not to be linear (expected: ${expectedSlope}, tolerance: ${tolerance})`
        : `Expected linear scaling with slope ~${expectedSlope} (actual: ${actualSlope.toFixed(3)}, difference: ${slopeDifference.toFixed(3)}, tolerance: ${tolerance})`,
      pass
    };
  },

  /**
   * Assert cache effectiveness
   */
  toShowCacheEffectiveness(received, minimumImprovement = 50) {
    const { uncached, cached } = received;
    const improvement = ((uncached - cached) / uncached) * 100;
    const pass = improvement >= minimumImprovement;

    return {
      message: () => pass
        ? `Expected cache improvement ${improvement.toFixed(2)}% not to meet minimum ${minimumImprovement}%`
        : `Expected cache to show at least ${minimumImprovement}% improvement (actual: ${improvement.toFixed(2)}%, uncached: ${uncached.toFixed(2)}ms, cached: ${cached.toFixed(2)}ms)`,
      pass
    };
  }
});

// Helper functions for performance testing
global.performanceMatchers = {
  /**
   * Measure function execution time
   */
  async measureExecutionTime(fn) {
    const startTime = performance.now();
    const result = await fn();
    const endTime = performance.now();

    return {
      result,
      executionTime: endTime - startTime
    };
  },

  /**
   * Run multiple iterations and collect statistics
   */
  async runBenchmark(fn, iterations = 10) {
    const measurements = [];

    // Warmup
    await fn();

    // Actual measurements
    for (let i = 0; i < iterations; i++) {
      const { executionTime } = await this.measureExecutionTime(fn);
      measurements.push(executionTime);
    }

    return this.calculateStatistics(measurements);
  },

  /**
   * Calculate statistics from measurements
   */
  calculateStatistics(measurements) {
    if (measurements.length === 0) {
      throw new Error('No measurements provided');
    }

    const sorted = measurements.sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: sorted.length,
      raw: measurements
    };
  },

  /**
   * Assert response time distribution
   */
  validateResponseTimeDistribution(measurements, slaTarget = 1000, percentile = 95) {
    const stats = this.calculateStatistics(measurements);
    const percentileKey = `p${percentile}`;
    const percentileValue = stats[percentileKey];

    return {
      stats,
      slaCompliant: percentileValue <= slaTarget,
      percentileValue,
      slaTarget,
      percentile
    };
  },

  /**
   * Compare two sets of measurements
   */
  comparePerformance(baseline, current, metric = 'mean') {
    const baselineStats = Array.isArray(baseline) ? this.calculateStatistics(baseline) : baseline;
    const currentStats = Array.isArray(current) ? this.calculateStatistics(current) : current;

    const baselineValue = baselineStats[metric];
    const currentValue = currentStats[metric];

    const change = currentValue - baselineValue;
    const changePercent = (change / baselineValue) * 100;

    return {
      baseline: baselineValue,
      current: currentValue,
      change,
      changePercent,
      improved: change < 0,
      degraded: change > 0,
      metric
    };
  }
};

// Make utilities available globally
global.measureExecutionTime = global.performanceMatchers.measureExecutionTime.bind(global.performanceMatchers);
global.runBenchmark = global.performanceMatchers.runBenchmark.bind(global.performanceMatchers);
global.calculateStatistics = global.performanceMatchers.calculateStatistics.bind(global.performanceMatchers);