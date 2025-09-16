/**
 * Custom Jest Matchers for Integration Tests
 *
 * Provides specialized matchers for testing integration scenarios,
 * performance thresholds, and system behavior validation.
 */

import { MatcherFunction } from 'expect';

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toCompleteWithinTime(maxTime: number): R;
      toHaveValidDatabaseConnection(): R;
      toHaveCacheHitRateAbove(threshold: number): R;
      toBeHealthyService(): R;
      toHaveValidMetrics(): R;
      toHandleErrorsGracefully(): R;
      toMaintainDataConsistency(): R;
      toPassPerformanceThreshold(threshold: { metric: string; value: number }): R;
    }
  }
}

/**
 * Check if operation completes within specified time
 */
const toCompleteWithinTime: MatcherFunction<[maxTime: number]> = function (
  received: Promise<any> | (() => Promise<any>),
  maxTime: number
) {
  const isNot = this.isNot;
  const matcherName = 'toCompleteWithinTime';

  return new Promise(async (resolve) => {
    const startTime = Date.now();

    try {
      if (typeof received === 'function') {
        await received();
      } else {
        await received;
      }

      const duration = Date.now() - startTime;
      const pass = duration <= maxTime;

      resolve({
        message: () =>
          `Expected operation ${isNot ? 'not ' : ''}to complete within ${maxTime}ms, but took ${duration}ms`,
        pass
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      resolve({
        message: () =>
          `Operation failed after ${duration}ms with error: ${error.message}`,
        pass: false
      });
    }
  });
};

/**
 * Check if service has valid database connection
 */
const toHaveValidDatabaseConnection: MatcherFunction<[]> = function (received: any) {
  const isNot = this.isNot;
  const matcherName = 'toHaveValidDatabaseConnection';

  return new Promise(async (resolve) => {
    try {
      // Try to get metrics (basic connectivity test)
      const metrics = await received.getMetrics();
      const pass = metrics !== null && metrics !== undefined;

      resolve({
        message: () =>
          `Expected service ${isNot ? 'not ' : ''}to have valid database connection`,
        pass
      });
    } catch (error) {
      resolve({
        message: () =>
          `Database connection test failed: ${error.message}`,
        pass: false
      });
    }
  });
};

/**
 * Check cache hit rate
 */
const toHaveCacheHitRateAbove: MatcherFunction<[threshold: number]> = function (
  received: any,
  threshold: number
) {
  const isNot = this.isNot;
  const matcherName = 'toHaveCacheHitRateAbove';

  const stats = received.stats();
  const hitRate = stats.hitRate || 0;
  const pass = hitRate >= threshold;

  return {
    message: () =>
      `Expected cache hit rate ${isNot ? 'not ' : ''}to be above ${threshold}, but was ${hitRate}`,
    pass
  };
};

/**
 * Check if service is healthy
 */
const toBeHealthyService: MatcherFunction<[]> = function (received: any) {
  const isNot = this.isNot;
  const matcherName = 'toBeHealthyService';

  return new Promise(async (resolve) => {
    try {
      const health = await received.healthCheck();
      const pass = health.healthy === true;

      resolve({
        message: () => {
          const issues = health.services ?
            Object.entries(health.services)
              .filter(([, serviceHealth]) => !serviceHealth.healthy)
              .map(([serviceName, serviceHealth]) => `${serviceName}: ${serviceHealth.error}`)
              .join(', ') : 'Unknown issues';

          return `Expected service ${isNot ? 'not ' : ''}to be healthy. Issues: ${issues}`;
        },
        pass
      });
    } catch (error) {
      resolve({
        message: () =>
          `Health check failed: ${error.message}`,
        pass: false
      });
    }
  });
};

/**
 * Check if metrics are valid
 */
const toHaveValidMetrics: MatcherFunction<[]> = function (received: any) {
  const isNot = this.isNot;
  const matcherName = 'toHaveValidMetrics';

  return new Promise(async (resolve) => {
    try {
      const metrics = await received.getMetrics();

      const hasRequiredFields = metrics &&
        typeof metrics === 'object' &&
        'totalEntries' in metrics;

      const pass = hasRequiredFields;

      resolve({
        message: () =>
          `Expected metrics ${isNot ? 'not ' : ''}to be valid and contain required fields`,
        pass
      });
    } catch (error) {
      resolve({
        message: () =>
          `Metrics validation failed: ${error.message}`,
        pass: false
      });
    }
  });
};

/**
 * Check error handling capabilities
 */
const toHandleErrorsGracefully: MatcherFunction<[]> = function (received: any) {
  const isNot = this.isNot;
  const matcherName = 'toHandleErrorsGracefully';

  return new Promise(async (resolve) => {
    try {
      // Test with invalid input
      let errorHandled = false;

      try {
        await received.createEntry({
          title: '', // Invalid
          problem: 'test',
          solution: 'test',
          category: 'System',
          tags: []
        });
      } catch (error) {
        errorHandled = true;
      }

      // System should still be functional after error
      const stillFunctional = await received.getMetrics();
      const pass = errorHandled && stillFunctional;

      resolve({
        message: () =>
          `Expected service ${isNot ? 'not ' : ''}to handle errors gracefully and remain functional`,
        pass
      });
    } catch (error) {
      resolve({
        message: () =>
          `Error handling test failed: ${error.message}`,
        pass: false
      });
    }
  });
};

/**
 * Check data consistency
 */
const toMaintainDataConsistency: MatcherFunction<[]> = function (received: any) {
  const isNot = this.isNot;
  const matcherName = 'toMaintainDataConsistency';

  return new Promise(async (resolve) => {
    try {
      // Create entry
      const entry = await received.createEntry({
        title: 'Consistency Test',
        problem: 'Testing data consistency',
        solution: 'System should maintain data consistency',
        category: 'System',
        tags: ['test']
      });

      // Read back entry
      const retrieved = await received.getEntryById(entry.id);

      // Check consistency
      const consistent = retrieved &&
        retrieved.title === entry.title &&
        retrieved.problem === entry.problem &&
        retrieved.solution === entry.solution;

      // Cleanup
      if (entry.id) {
        await received.deleteEntry(entry.id);
      }

      resolve({
        message: () =>
          `Expected service ${isNot ? 'not ' : ''}to maintain data consistency across operations`,
        pass: consistent
      });
    } catch (error) {
      resolve({
        message: () =>
          `Data consistency test failed: ${error.message}`,
        pass: false
      });
    }
  });
};

/**
 * Check performance thresholds
 */
const toPassPerformanceThreshold: MatcherFunction<[threshold: { metric: string; value: number }]> = function (
  received: any,
  threshold: { metric: string; value: number }
) {
  const isNot = this.isNot;
  const matcherName = 'toPassPerformanceThreshold';

  return new Promise(async (resolve) => {
    try {
      const startTime = Date.now();

      // Perform operation based on metric type
      switch (threshold.metric) {
        case 'searchTime':
          await received.search('test query', { maxResults: 10 });
          break;
        case 'createTime':
          const entry = await received.createEntry({
            title: 'Performance Test',
            problem: 'Testing performance',
            solution: 'Should meet performance thresholds',
            category: 'System',
            tags: ['performance']
          });
          // Cleanup
          if (entry.id) {
            await received.deleteEntry(entry.id);
          }
          break;
        default:
          // Generic operation
          await received.getMetrics();
      }

      const duration = Date.now() - startTime;
      const pass = duration <= threshold.value;

      resolve({
        message: () =>
          `Expected ${threshold.metric} ${isNot ? 'not ' : ''}to be under ${threshold.value}ms, but was ${duration}ms`,
        pass
      });
    } catch (error) {
      resolve({
        message: () =>
          `Performance test failed: ${error.message}`,
        pass: false
      });
    }
  });
};

// Register custom matchers
expect.extend({
  toCompleteWithinTime,
  toHaveValidDatabaseConnection,
  toHaveCacheHitRateAbove,
  toBeHealthyService,
  toHaveValidMetrics,
  toHandleErrorsGracefully,
  toMaintainDataConsistency,
  toPassPerformanceThreshold
});

export {
  toCompleteWithinTime,
  toHaveValidDatabaseConnection,
  toHaveCacheHitRateAbove,
  toBeHealthyService,
  toHaveValidMetrics,
  toHandleErrorsGracefully,
  toMaintainDataConsistency,
  toPassPerformanceThreshold
};