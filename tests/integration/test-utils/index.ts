/**
 * Integration Test Utilities Index
 * Exports all utilities for integration testing
 */

export * from './workflow-orchestration';
export * from './performance-monitor';

// Re-export common types and utilities
export { EventEmitter } from 'events';

// Test configuration helpers
export interface TestConfig {
  timeout?: number;
  retries?: number;
  cleanup?: boolean;
  verbose?: boolean;
}

export const DEFAULT_TEST_CONFIG: TestConfig = {
  timeout: 30000,
  retries: 0,
  cleanup: true,
  verbose: false
};

// Common test utilities
export class TestUtils {
  /**
   * Wait for a condition to be true with timeout
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Create unique test identifiers
   */
  static createTestId(prefix: string = 'test'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate test data with specified patterns
   */
  static generateTestData<T>(
    generator: (index: number) => T,
    count: number
  ): T[] {
    return Array.from({ length: count }, (_, i) => generator(i));
  }

  /**
   * Measure execution time of async function
   */
  static async measureTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;
    
    return { result, duration };
  }

  /**
   * Retry an operation with exponential backoff
   */
  static async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * Create a mock implementation that tracks calls
   */
  static createMockTracker<T extends (...args: any[]) => any>(
    implementation?: T
  ): T & { calls: Parameters<T>[]; callCount: number; reset: () => void } {
    const calls: Parameters<T>[] = [];
    
    const mockFn = ((...args: Parameters<T>) => {
      calls.push(args);
      return implementation ? implementation(...args) : undefined;
    }) as T & { calls: Parameters<T>[]; callCount: number; reset: () => void };

    Object.defineProperties(mockFn, {
      calls: { get: () => calls },
      callCount: { get: () => calls.length },
      reset: { 
        value: () => {
          calls.length = 0;
        }
      }
    });

    return mockFn;
  }

  /**
   * Validate object structure matches expected interface
   */
  static validateStructure(
    obj: any,
    expectedKeys: string[],
    optionalKeys: string[] = []
  ): { valid: boolean; missing: string[]; extra: string[] } {
    const objKeys = Object.keys(obj || {});
    const allExpectedKeys = [...expectedKeys, ...optionalKeys];
    
    const missing = expectedKeys.filter(key => !objKeys.includes(key));
    const extra = objKeys.filter(key => !allExpectedKeys.includes(key));
    
    return {
      valid: missing.length === 0,
      missing,
      extra
    };
  }
}

// Test data generators
export class TestDataGenerator {
  private static counter = 0;

  /**
   * Generate realistic mainframe knowledge base entries
   */
  static createKBEntry(overrides?: Partial<any>): any {
    this.counter++;
    
    const categories = ['JCL', 'VSAM', 'DB2', 'Batch', 'CICS', 'IMS', 'System', 'Other'];
    const errorCodes = ['S0C7', 'S0C4', 'S806', 'S813', 'S822', 'IEF212I', 'SQLCODE-904'];
    
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const randomErrorCode = errorCodes[Math.floor(Math.random() * errorCodes.length)];
    
    return {
      title: `Test Entry ${this.counter} - ${randomErrorCode}`,
      problem: `Test problem description for ${randomErrorCode} in ${randomCategory} system. This is a generated test entry for integration testing purposes.`,
      solution: `1. Check system status\n2. Verify configuration\n3. Apply standard resolution for ${randomErrorCode}\n4. Monitor results`,
      category: randomCategory,
      tags: [`test-${this.counter}`, randomErrorCode.toLowerCase(), randomCategory.toLowerCase()],
      created_by: 'test-generator',
      ...overrides
    };
  }

  /**
   * Generate search queries based on common mainframe issues
   */
  static createSearchQueries(count: number = 10): string[] {
    const queries = [
      'VSAM file error',
      'JCL dataset not found',
      'S0C7 data exception',
      'DB2 connection timeout',
      'CICS transaction abend',
      'Batch job failure',
      'Storage shortage error',
      'Network connectivity issue',
      'Program compilation error',
      'System performance degradation'
    ];
    
    return Array.from({ length: count }, (_, i) => 
      queries[i % queries.length] + (i >= queries.length ? ` variant ${Math.floor(i / queries.length)}` : '')
    );
  }

  /**
   * Generate user IDs for testing
   */
  static createUserIds(count: number = 10): string[] {
    const roles = ['analyst', 'developer', 'admin', 'operator'];
    
    return Array.from({ length: count }, (_, i) => 
      `${roles[i % roles.length]}-${String(i + 1).padStart(3, '0')}`
    );
  }

  /**
   * Reset the counter for consistent test data
   */
  static resetCounter(): void {
    this.counter = 0;
  }
}

// Performance benchmarking utilities
export class BenchmarkUtils {
  /**
   * Run a simple performance benchmark
   */
  static async benchmark(
    name: string,
    operation: () => Promise<any>,
    iterations: number = 100
  ): Promise<{
    name: string;
    iterations: number;
    totalTime: number;
    averageTime: number;
    minTime: number;
    maxTime: number;
    throughput: number;
  }> {
    const times: number[] = [];
    let totalTime = 0;
    
    console.log(`Starting benchmark: ${name} (${iterations} iterations)`);
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await operation();
      const duration = Date.now() - startTime;
      
      times.push(duration);
      totalTime += duration;
    }
    
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = iterations / (totalTime / 1000); // ops per second
    
    const result = {
      name,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      throughput
    };
    
    console.log(`Benchmark complete: ${name}`);
    console.log(`  Average: ${averageTime.toFixed(2)}ms`);
    console.log(`  Min/Max: ${minTime}ms / ${maxTime}ms`);
    console.log(`  Throughput: ${throughput.toFixed(2)} ops/sec`);
    
    return result;
  }

  /**
   * Compare performance of two operations
   */
  static async compare(
    name1: string,
    operation1: () => Promise<any>,
    name2: string,
    operation2: () => Promise<any>,
    iterations: number = 100
  ): Promise<{
    baseline: any;
    comparison: any;
    improvement: number; // positive means operation2 is faster
    significantDifference: boolean;
  }> {
    const baseline = await this.benchmark(name1, operation1, iterations);
    const comparison = await this.benchmark(name2, operation2, iterations);
    
    const improvement = (baseline.averageTime - comparison.averageTime) / baseline.averageTime;
    const significantDifference = Math.abs(improvement) > 0.05; // 5% threshold
    
    console.log(`Performance comparison:`);
    console.log(`  ${name1}: ${baseline.averageTime.toFixed(2)}ms`);
    console.log(`  ${name2}: ${comparison.averageTime.toFixed(2)}ms`);
    console.log(`  Improvement: ${(improvement * 100).toFixed(1)}% ${improvement > 0 ? 'faster' : 'slower'}`);
    
    return {
      baseline,
      comparison,
      improvement,
      significantDifference
    };
  }
}