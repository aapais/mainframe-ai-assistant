import { performance } from 'perf_hooks';

/**
 * Custom Jest matchers for performance testing
 */

interface PerformanceExpectation {
  toHaveExecutedWithin(maxTime: number): { pass: boolean; message: () => string };
  toHaveExecutedFasterThan(comparisonTime: number): { pass: boolean; message: () => string };
  toHaveMemoryUsageLessThan(maxMemoryMB: number): { pass: boolean; message: () => string };
  toHaveThroughputGreaterThan(minOpsPerSecond: number): { pass: boolean; message: () => string };
  toMeetPerformanceRequirement(requirement: PerformanceRequirement): { pass: boolean; message: () => string };
}

interface PerformanceRequirement {
  name: string;
  target: number;
  unit: string;
  comparison: 'lessThan' | 'greaterThan' | 'equal';
}

declare global {
  namespace jest {
    interface Matchers<R> extends PerformanceExpectation {}
  }
}

expect.extend({
  /**
   * Assert that an operation completed within a specified time
   */
  toHaveExecutedWithin(received: number, maxTime: number) {
    const pass = received <= maxTime;
    
    return {
      pass,
      message: () =>
        pass
          ? `Expected execution time ${received}ms not to be within ${maxTime}ms`
          : `Expected execution time ${received}ms to be within ${maxTime}ms (exceeded by ${received - maxTime}ms)`
    };
  },

  /**
   * Assert that an operation executed faster than a comparison
   */
  toHaveExecutedFasterThan(received: number, comparisonTime: number) {
    const pass = received < comparisonTime;
    const percentageFaster = comparisonTime > 0 ? ((comparisonTime - received) / comparisonTime * 100) : 0;
    
    return {
      pass,
      message: () =>
        pass
          ? `Expected execution time ${received}ms not to be faster than ${comparisonTime}ms (${percentageFaster.toFixed(1)}% faster)`
          : `Expected execution time ${received}ms to be faster than ${comparisonTime}ms (${Math.abs(percentageFaster).toFixed(1)}% slower)`
    };
  },

  /**
   * Assert that memory usage is below a threshold
   */
  toHaveMemoryUsageLessThan(received: NodeJS.MemoryUsage, maxMemoryMB: number) {
    const actualMemoryMB = received.heapUsed / 1024 / 1024;
    const pass = actualMemoryMB < maxMemoryMB;
    
    return {
      pass,
      message: () =>
        pass
          ? `Expected memory usage ${actualMemoryMB.toFixed(2)}MB not to be less than ${maxMemoryMB}MB`
          : `Expected memory usage ${actualMemoryMB.toFixed(2)}MB to be less than ${maxMemoryMB}MB (exceeded by ${(actualMemoryMB - maxMemoryMB).toFixed(2)}MB)`
    };
  },

  /**
   * Assert that throughput meets minimum requirements
   */
  toHaveThroughputGreaterThan(received: number, minOpsPerSecond: number) {
    const pass = received > minOpsPerSecond;
    const percentageDifference = minOpsPerSecond > 0 ? ((received - minOpsPerSecond) / minOpsPerSecond * 100) : 0;
    
    return {
      pass,
      message: () =>
        pass
          ? `Expected throughput ${received.toFixed(2)} ops/sec not to be greater than ${minOpsPerSecond} ops/sec`
          : `Expected throughput ${received.toFixed(2)} ops/sec to be greater than ${minOpsPerSecond} ops/sec (${Math.abs(percentageDifference).toFixed(1)}% ${percentageDifference < 0 ? 'below' : 'above'} target)`
    };
  },

  /**
   * Assert that a value meets a performance requirement
   */
  toMeetPerformanceRequirement(received: number, requirement: PerformanceRequirement) {
    let pass = false;
    let comparison = '';
    
    switch (requirement.comparison) {
      case 'lessThan':
        pass = received < requirement.target;
        comparison = 'less than';
        break;
      case 'greaterThan':
        pass = received > requirement.target;
        comparison = 'greater than';
        break;
      case 'equal':
        pass = Math.abs(received - requirement.target) < (requirement.target * 0.05); // 5% tolerance
        comparison = 'approximately equal to';
        break;
    }
    
    const deviation = Math.abs(received - requirement.target);
    const deviationPercent = requirement.target > 0 ? (deviation / requirement.target * 100) : 0;
    
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${requirement.name} ${received}${requirement.unit} not to be ${comparison} ${requirement.target}${requirement.unit}`
          : `Expected ${requirement.name} ${received}${requirement.unit} to be ${comparison} ${requirement.target}${requirement.unit} (deviation: ${deviation.toFixed(2)}${requirement.unit} / ${deviationPercent.toFixed(1)}%)`
    };
  }
});

/**
 * Helper function to measure execution time
 */
export function measureExecutionTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; executionTime: number }> {
  return new Promise(async (resolve, reject) => {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      resolve({ result, executionTime });
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Attach execution time to error for debugging
      (error as any).executionTime = executionTime;
      reject(error);
    }
  });
}

/**
 * Helper function to measure memory usage
 */
export function measureMemoryUsage<T>(fn: () => T | Promise<T>): Promise<{ result: T; memoryDelta: number; memoryUsage: NodeJS.MemoryUsage }> {
  return new Promise(async (resolve, reject) => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const startMemory = process.memoryUsage();
    
    try {
      const result = await fn();
      
      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }
      
      const endMemory = process.memoryUsage();
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      resolve({ result, memoryDelta, memoryUsage: endMemory });
    } catch (error) {
      const endMemory = process.memoryUsage();
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      // Attach memory info to error for debugging
      (error as any).memoryDelta = memoryDelta;
      (error as any).memoryUsage = endMemory;
      reject(error);
    }
  });
}

/**
 * Helper function to measure both time and memory
 */
export function measurePerformance<T>(fn: () => T | Promise<T>): Promise<{
  result: T;
  executionTime: number;
  memoryDelta: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}> {
  return new Promise(async (resolve, reject) => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();
    
    try {
      const result = await fn();
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage(startCpu);
      
      const executionTime = endTime - startTime;
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      resolve({
        result,
        executionTime,
        memoryDelta,
        memoryUsage: endMemory,
        cpuUsage: endCpu
      });
    } catch (error) {
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage(startCpu);
      
      const executionTime = endTime - startTime;
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      
      // Attach performance info to error for debugging
      (error as any).performance = {
        executionTime,
        memoryDelta,
        memoryUsage: endMemory,
        cpuUsage: endCpu
      };
      
      reject(error);
    }
  });
}

/**
 * Helper to create performance thresholds
 */
export const PerformanceThresholds = {
  MVP1: {
    SEARCH_LOCAL_TIME: 1000,        // 1s for local search
    SEARCH_AI_TIME: 2000,          // 2s for AI search with fallback
    DATABASE_QUERY_TIME: 50,       // 50ms for simple queries
    UI_RENDER_TIME: 100,           // 100ms for UI rendering
    APP_STARTUP_TIME: 5000,        // 5s for app startup
    MEMORY_USAGE_MAX: 500,         // 500MB max memory usage
    THROUGHPUT_MIN: 100            // 100 ops/sec minimum throughput
  }
};

/**
 * Helper to validate MVP1 requirements
 */
export function validateMVP1Performance(metrics: {
  searchTime?: number;
  databaseTime?: number;
  uiRenderTime?: number;
  startupTime?: number;
  memoryUsage?: number;
  throughput?: number;
}): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  
  if (metrics.searchTime && metrics.searchTime > PerformanceThresholds.MVP1.SEARCH_LOCAL_TIME) {
    violations.push(`Search time ${metrics.searchTime}ms exceeds limit of ${PerformanceThresholds.MVP1.SEARCH_LOCAL_TIME}ms`);
  }
  
  if (metrics.databaseTime && metrics.databaseTime > PerformanceThresholds.MVP1.DATABASE_QUERY_TIME) {
    violations.push(`Database query time ${metrics.databaseTime}ms exceeds limit of ${PerformanceThresholds.MVP1.DATABASE_QUERY_TIME}ms`);
  }
  
  if (metrics.uiRenderTime && metrics.uiRenderTime > PerformanceThresholds.MVP1.UI_RENDER_TIME) {
    violations.push(`UI render time ${metrics.uiRenderTime}ms exceeds limit of ${PerformanceThresholds.MVP1.UI_RENDER_TIME}ms`);
  }
  
  if (metrics.startupTime && metrics.startupTime > PerformanceThresholds.MVP1.APP_STARTUP_TIME) {
    violations.push(`App startup time ${metrics.startupTime}ms exceeds limit of ${PerformanceThresholds.MVP1.APP_STARTUP_TIME}ms`);
  }
  
  if (metrics.memoryUsage && metrics.memoryUsage > PerformanceThresholds.MVP1.MEMORY_USAGE_MAX) {
    violations.push(`Memory usage ${metrics.memoryUsage}MB exceeds limit of ${PerformanceThresholds.MVP1.MEMORY_USAGE_MAX}MB`);
  }
  
  if (metrics.throughput && metrics.throughput < PerformanceThresholds.MVP1.THROUGHPUT_MIN) {
    violations.push(`Throughput ${metrics.throughput} ops/sec below minimum of ${PerformanceThresholds.MVP1.THROUGHPUT_MIN} ops/sec`);
  }
  
  return {
    passed: violations.length === 0,
    violations
  };
}