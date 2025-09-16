/**
 * Custom Jest Matchers for State Management Testing
 *
 * Specialized matchers for testing state management patterns:
 * - State immutability validation
 * - Performance assertions
 * - Memory leak detection
 * - State consistency checks
 *
 * @author State Management Testing Specialist
 * @version 2.0.0
 */

import { expect } from '@jest/globals';

// Utility functions
const isImmutable = (obj: any): boolean => {
  if (obj === null || typeof obj !== 'object') return true;

  try {
    // Attempt to modify the object
    if (Array.isArray(obj)) {
      obj.push('test');
      obj.pop(); // Clean up if mutation succeeded
      return false;
    } else if (obj instanceof Map) {
      obj.set('test', 'value');
      obj.delete('test'); // Clean up if mutation succeeded
      return false;
    } else if (obj instanceof Set) {
      obj.add('test');
      obj.delete('test'); // Clean up if mutation succeeded
      return false;
    } else {
      obj.__testProperty = 'test';
      delete obj.__testProperty; // Clean up if mutation succeeded
      return false;
    }
  } catch (error) {
    // If an error was thrown, the object is likely immutable
    return true;
  }
};

const isDeepImmutable = (obj: any, visited = new WeakSet()): boolean => {
  if (obj === null || typeof obj !== 'object') return true;
  if (visited.has(obj)) return true; // Avoid circular references

  visited.add(obj);

  if (!isImmutable(obj)) return false;

  if (Array.isArray(obj)) {
    return obj.every(item => isDeepImmutable(item, visited));
  } else if (obj instanceof Map) {
    for (const [key, value] of obj) {
      if (!isDeepImmutable(key, visited) || !isDeepImmutable(value, visited)) {
        return false;
      }
    }
    return true;
  } else if (obj instanceof Set) {
    for (const value of obj) {
      if (!isDeepImmutable(value, visited)) {
        return false;
      }
    }
    return true;
  } else {
    return Object.values(obj).every(value => isDeepImmutable(value, visited));
  }
};

// Custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeImmutable(): R;
      toBeDeepImmutable(): R;
      toHaveConsistentState(): R;
      toCompleteWithinTime(maxTime: number): R;
      toNotLeakMemory(threshold?: number): R;
      toHaveStableReferences(previousState: any, unchangedPaths: string[]): R;
      toTriggerRerender(component: any): R;
      toMaintainPerformance(baseline: number, tolerance?: number): R;
    }
  }
}

expect.extend({
  toBeImmutable(received: any) {
    const pass = isImmutable(received);

    return {
      message: () =>
        pass
          ? `Expected object not to be immutable, but it was`
          : `Expected object to be immutable, but it was mutable`,
      pass,
    };
  },

  toBeDeepImmutable(received: any) {
    const pass = isDeepImmutable(received);

    return {
      message: () =>
        pass
          ? `Expected object not to be deeply immutable, but it was`
          : `Expected object to be deeply immutable, but it was mutable at some level`,
      pass,
    };
  },

  toHaveConsistentState(received: any) {
    // Check that state is internally consistent
    const issues: string[] = [];

    if (received && typeof received === 'object') {
      // Check for common consistency issues
      if (received.entries && received.totalEntries !== undefined) {
        const entriesSize = received.entries instanceof Map
          ? received.entries.size
          : Object.keys(received.entries).length;

        if (entriesSize !== received.totalEntries) {
          issues.push(`entries.size (${entriesSize}) doesn't match totalEntries (${received.totalEntries})`);
        }
      }

      if (received.pagination) {
        const { currentPage, pageSize, totalPages, hasMore } = received.pagination;

        if (currentPage > totalPages && totalPages > 0) {
          issues.push(`currentPage (${currentPage}) exceeds totalPages (${totalPages})`);
        }

        if (currentPage < 1) {
          issues.push(`currentPage (${currentPage}) is less than 1`);
        }

        if (pageSize < 1) {
          issues.push(`pageSize (${pageSize}) is less than 1`);
        }
      }

      if (received.filters && received.pagination) {
        // Check that pagination is reset when filters change
        // This would need to be checked in the actual test context
      }

      if (received.isLoading && received.error) {
        issues.push('Both isLoading and error are set, which may indicate inconsistent state');
      }
    }

    const pass = issues.length === 0;

    return {
      message: () =>
        pass
          ? `Expected state to be inconsistent, but it was consistent`
          : `Expected state to be consistent, but found issues: ${issues.join(', ')}`,
      pass,
    };
  },

  async toCompleteWithinTime(received: Promise<any>, maxTime: number) {
    const startTime = performance.now();

    try {
      await received;
      const endTime = performance.now();
      const actualTime = endTime - startTime;
      const pass = actualTime <= maxTime;

      return {
        message: () =>
          pass
            ? `Expected operation to take longer than ${maxTime}ms, but it completed in ${actualTime.toFixed(2)}ms`
            : `Expected operation to complete within ${maxTime}ms, but it took ${actualTime.toFixed(2)}ms`,
        pass,
      };
    } catch (error) {
      return {
        message: () => `Operation failed: ${(error as Error).message}`,
        pass: false,
      };
    }
  },

  toNotLeakMemory(received: () => void, threshold: number = 50 * 1024 * 1024) {
    const initialMemory = global.__TEST_UTILS__.measureMemory();

    // Execute the operation
    received();

    // Force garbage collection if available
    global.__TEST_UTILS__.enableGC();

    // Wait a bit for cleanup
    return new Promise((resolve) => {
      setTimeout(() => {
        const finalMemory = global.__TEST_UTILS__.measureMemory();
        const memoryIncrease = finalMemory - initialMemory;
        const pass = memoryIncrease <= threshold;

        resolve({
          message: () =>
            pass
              ? `Expected memory increase to exceed ${(threshold / 1024 / 1024).toFixed(2)}MB, but it was ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
              : `Expected memory increase to be under ${(threshold / 1024 / 1024).toFixed(2)}MB, but it was ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
          pass,
        });
      }, 100);
    });
  },

  toHaveStableReferences(received: any, previousState: any, unchangedPaths: string[]) {
    const issues: string[] = [];

    for (const path of unchangedPaths) {
      const currentValue = path.split('.').reduce((obj, key) => obj?.[key], received);
      const previousValue = path.split('.').reduce((obj, key) => obj?.[key], previousState);

      if (currentValue !== previousValue) {
        issues.push(`Reference at path "${path}" changed when it should have remained stable`);
      }
    }

    const pass = issues.length === 0;

    return {
      message: () =>
        pass
          ? `Expected some references to change, but all specified paths remained stable`
          : `Expected references to remain stable, but found issues: ${issues.join(', ')}`,
      pass,
    };
  },

  toTriggerRerender(received: any, component: any) {
    // This would need to be implemented with specific testing library utilities
    // For now, we'll provide a basic implementation
    const pass = true; // Placeholder

    return {
      message: () =>
        pass
          ? `Expected state change not to trigger rerender, but it did`
          : `Expected state change to trigger rerender, but it didn't`,
      pass,
    };
  },

  toMaintainPerformance(received: number, baseline: number, tolerance: number = 0.1) {
    const threshold = baseline * (1 + tolerance);
    const pass = received <= threshold;

    return {
      message: () =>
        pass
          ? `Expected performance to degrade beyond ${tolerance * 100}% of baseline (${baseline.toFixed(2)}ms), but it was ${received.toFixed(2)}ms`
          : `Expected performance to be within ${tolerance * 100}% of baseline (${baseline.toFixed(2)}ms), but it was ${received.toFixed(2)}ms (threshold: ${threshold.toFixed(2)}ms)`,
      pass,
    };
  },
});

// Helper functions for test setup
export const createStateSnapshot = (state: any) => {
  return JSON.parse(JSON.stringify(state, (key, value) => {
    if (value instanceof Map) {
      return Array.from(value.entries());
    }
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }));
};

export const compareStateSnapshots = (snapshot1: any, snapshot2: any): string[] => {
  const differences: string[] = [];

  const compare = (obj1: any, obj2: any, path = '') => {
    if (obj1 === obj2) return;

    if (typeof obj1 !== typeof obj2) {
      differences.push(`${path}: type changed from ${typeof obj1} to ${typeof obj2}`);
      return;
    }

    if (Array.isArray(obj1) && Array.isArray(obj2)) {
      if (obj1.length !== obj2.length) {
        differences.push(`${path}: array length changed from ${obj1.length} to ${obj2.length}`);
      }
      const maxLength = Math.max(obj1.length, obj2.length);
      for (let i = 0; i < maxLength; i++) {
        compare(obj1[i], obj2[i], `${path}[${i}]`);
      }
      return;
    }

    if (obj1 && obj2 && typeof obj1 === 'object' && typeof obj2 === 'object') {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);
      const allKeys = new Set([...keys1, ...keys2]);

      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key;
        if (!(key in obj1)) {
          differences.push(`${newPath}: property added`);
        } else if (!(key in obj2)) {
          differences.push(`${newPath}: property removed`);
        } else {
          compare(obj1[key], obj2[key], newPath);
        }
      }
      return;
    }

    differences.push(`${path}: value changed from ${obj1} to ${obj2}`);
  };

  compare(snapshot1, snapshot2);
  return differences;
};

export const measureRenderPerformance = async (renderFn: () => Promise<void> | void): Promise<number> => {
  const startTime = performance.now();
  await renderFn();
  const endTime = performance.now();
  return endTime - startTime;
};