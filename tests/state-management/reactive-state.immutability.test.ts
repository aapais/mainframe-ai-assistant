/**
 * Reactive State Store Immutability Tests
 *
 * Comprehensive test suite for state immutability and data integrity:
 * - State mutation detection and prevention
 * - Deep immutability validation
 * - Immer integration testing
 * - Object freeze validation
 * - Reference equality checks
 * - Nested object immutability
 * - Array operation safety
 * - Map/Set immutability
 * - Performance impact of immutability
 * - Memory leak prevention
 *
 * @author State Management Testing Specialist
 * @version 2.0.0
 */

import { act, renderHook } from '@testing-library/react';
import { useReactiveStore, selectEntries, selectLoading, selectErrors, selectMetrics, selectFilters, selectPagination, ReactiveState, ReactiveActions } from '../../src/renderer/stores/reactive-state';
import { KBEntry, KBEntryInput, KBEntryUpdate } from '../../src/types';

// Deep equality utilities for testing
const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => deepEqual(item, b[index]));
    }

    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [key, value] of a) {
        if (!b.has(key) || !deepEqual(value, b.get(key))) return false;
      }
      return true;
    }

    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      for (const value of a) {
        if (!b.has(value)) return false;
      }
      return true;
    }

    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  return false;
};

const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;

  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) return obj.map(deepClone) as T;
  if (obj instanceof Map) {
    const cloned = new Map();
    for (const [key, value] of obj) {
      cloned.set(key, deepClone(value));
    }
    return cloned as T;
  }
  if (obj instanceof Set) {
    const cloned = new Set();
    for (const value of obj) {
      cloned.add(deepClone(value));
    }
    return cloned as T;
  }

  const cloned = {} as T;
  for (const [key, value] of Object.entries(obj)) {
    (cloned as any)[key] = deepClone(value);
  }
  return cloned;
};

// Mutation detection utilities
interface MutationDetector {
  snapshots: Map<string, any>;
  violations: Array<{
    id: string;
    path: string;
    original: any;
    mutated: any;
    timestamp: number;
  }>;
}

const createMutationDetector = (): MutationDetector => ({
  snapshots: new Map(),
  violations: [],
});

const takeSnapshot = (detector: MutationDetector, id: string, state: any) => {
  detector.snapshots.set(id, deepClone(state));
};

const checkForMutations = (detector: MutationDetector, id: string, currentState: any): boolean => {
  const snapshot = detector.snapshots.get(id);
  if (!snapshot) return false;

  if (!deepEqual(snapshot, currentState)) {
    detector.violations.push({
      id,
      path: 'root',
      original: snapshot,
      mutated: currentState,
      timestamp: Date.now(),
    });
    return true;
  }

  return false;
};

// Test data generators
const generateMockEntry = (id: string, overrides: Partial<KBEntry> = {}): KBEntry => ({
  id,
  title: `Test Entry ${id}`,
  problem: `Problem description for ${id}`,
  solution: `Solution for ${id}`,
  category: 'VSAM',
  tags: ['test', 'mock'],
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  usage_count: 0,
  success_count: 0,
  failure_count: 0,
  ...overrides,
});

// Mock electronAPI with immutability testing
const mockElectronAPI = {
  getKBEntries: jest.fn(),
  addKBEntry: jest.fn(),
  updateKBEntry: jest.fn(),
  deleteKBEntry: jest.fn(),
  getKBEntry: jest.fn(),
  rateKBEntry: jest.fn(),
  recordEntryView: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Immutability test helpers
const attemptDirectMutation = (state: ReactiveState & ReactiveActions): string[] => {
  const violations: string[] = [];

  try {
    // Attempt to mutate entries Map
    (state.entries as any).set('mutation-test', { invalid: 'data' });
    violations.push('entries Map mutation allowed');
  } catch (error) {
    // Expected - should throw
  }

  try {
    // Attempt to mutate categories array
    (state.categories as any).push('INVALID_CATEGORY');
    violations.push('categories array mutation allowed');
  } catch (error) {
    // Expected - should throw
  }

  try {
    // Attempt to mutate errors Map
    (state.errors as any).set('mutation-test', { invalid: 'error' });
    violations.push('errors Map mutation allowed');
  } catch (error) {
    // Expected - should throw
  }

  try {
    // Attempt to mutate filters object
    (state.filters as any).invalidProperty = 'invalid';
    violations.push('filters object mutation allowed');
  } catch (error) {
    // Expected - should throw
  }

  try {
    // Attempt to mutate pagination object
    (state.pagination as any).invalidProperty = 'invalid';
    violations.push('pagination object mutation allowed');
  } catch (error) {
    // Expected - should throw
  }

  return violations;
};

const attemptNestedMutation = (state: ReactiveState & ReactiveActions): string[] => {
  const violations: string[] = [];

  // Try to mutate entries within the Map
  for (const [id, entry] of state.entries) {
    try {
      (entry as any).title = 'MUTATED_TITLE';
      violations.push(`entry ${id} mutation allowed`);
    } catch (error) {
      // Expected - should throw
    }

    try {
      (entry.tags as any).push('INVALID_TAG');
      violations.push(`entry ${id} tags array mutation allowed`);
    } catch (error) {
      // Expected - should throw
    }
  }

  // Try to mutate nested objects in errors
  for (const [id, error] of state.errors) {
    try {
      (error as any).message = 'MUTATED_MESSAGE';
      violations.push(`error ${id} mutation allowed`);
    } catch (error) {
      // Expected - should throw
    }
  }

  return violations;
};

describe('Reactive State Store - Immutability Tests', () => {
  let mutationDetector: MutationDetector;

  beforeEach(() => {
    jest.clearAllMocks();
    mutationDetector = createMutationDetector();

    // Reset store to initial state
    useReactiveStore.setState({
      entries: new Map(),
      categories: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other'],
      isLoading: false,
      isSaving: false,
      isDeleting: false,
      isOffline: false,
      isSyncing: false,
      errors: new Map(),
      optimisticOperations: new Map(),
      rollbackData: new Map(),
      syncQueue: [],
      lastSyncTimestamp: 0,
      conflicts: new Map(),
      metrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        optimisticSuccessRate: 0,
      },
      filters: {},
      pagination: {
        currentPage: 1,
        pageSize: 50,
        totalPages: 1,
        hasMore: false,
      },
    });
  });

  describe('State Mutation Prevention', () => {
    it('should prevent direct mutation of state objects', () => {
      const { result } = renderHook(() => useReactiveStore());

      const violations = attemptDirectMutation(result.current);

      expect(violations).toHaveLength(0);
    });

    it('should prevent mutation of nested objects and arrays', () => {
      const { result } = renderHook(() => useReactiveStore());

      // Populate some data first
      const mockEntry = generateMockEntry('immutable-test');
      act(() => {
        useReactiveStore.setState({
          entries: new Map([['immutable-test', mockEntry]]),
          errors: new Map([['test-error', {
            code: 'TEST_ERROR',
            message: 'Test error message',
            timestamp: Date.now(),
          }]]),
        });
      });

      const violations = attemptNestedMutation(result.current);

      expect(violations).toHaveLength(0);
    });

    it('should create new object references on state updates', () => {
      const { result } = renderHook(() => useReactiveStore());

      const initialState = result.current;
      takeSnapshot(mutationDetector, 'initial', initialState);

      // Update state
      act(() => {
        result.current.updateFilters({ category: 'JCL' });
      });

      const updatedState = result.current;

      // State reference should change
      expect(updatedState).not.toBe(initialState);

      // Filters reference should change
      expect(updatedState.filters).not.toBe(initialState.filters);

      // Unchanged objects should maintain reference equality for performance
      expect(updatedState.categories).toBe(initialState.categories);
      expect(updatedState.metrics).toBe(initialState.metrics);
    });

    it('should maintain immutability during complex operations', async () => {
      const { result } = renderHook(() => useReactiveStore());

      const mockEntry = generateMockEntry('complex-op');
      mockElectronAPI.addKBEntry.mockResolvedValue(mockEntry);

      takeSnapshot(mutationDetector, 'before-operation', result.current);

      // Perform complex operation
      await act(async () => {
        await result.current.createEntry({
          title: 'Complex Operation Entry',
          problem: 'Complex problem',
          solution: 'Complex solution',
          category: 'VSAM',
          tags: ['complex', 'test'],
        });
      });

      const hasMutations = checkForMutations(mutationDetector, 'before-operation', result.current);

      // Should not have mutated the original state
      expect(hasMutations).toBe(true); // State should have changed (new entry added)

      // But the new state should be properly immutable
      const violations = attemptDirectMutation(result.current);
      expect(violations).toHaveLength(0);
    });
  });

  describe('Deep Immutability Validation', () => {
    it('should enforce deep immutability on Map entries', () => {
      const { result } = renderHook(() => useReactiveStore());

      const mockEntry = generateMockEntry('deep-immutable', {
        tags: ['tag1', 'tag2'],
        metadata: { nested: { value: 42 } } as any,
      });

      act(() => {
        useReactiveStore.setState({
          entries: new Map([['deep-immutable', mockEntry]]),
        });
      });

      const entry = result.current.entries.get('deep-immutable');
      expect(entry).toBeTruthy();

      // Attempt to mutate nested structures
      try {
        (entry!.tags as any)[0] = 'MUTATED_TAG';
        throw new Error('Tag mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Tag mutation should have been prevented');
      }

      try {
        ((entry as any).metadata.nested as any).value = 999;
        throw new Error('Nested object mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Nested object mutation should have been prevented');
      }
    });

    it('should maintain immutability through Map operations', () => {
      const { result } = renderHook(() => useReactiveStore());

      const entries = [
        generateMockEntry('entry-1'),
        generateMockEntry('entry-2'),
        generateMockEntry('entry-3'),
      ];

      act(() => {
        useReactiveStore.setState({
          entries: new Map(entries.map(e => [e.id, e])),
        });
      });

      const originalMap = result.current.entries;

      // Add new entry
      act(() => {
        result.current.entries.set('entry-4', generateMockEntry('entry-4'));
      });

      // Original map should not be mutated
      expect(originalMap.has('entry-4')).toBe(false);
      expect(result.current.entries.has('entry-4')).toBe(true);

      // Maps should be different instances
      expect(result.current.entries).not.toBe(originalMap);
    });

    it('should preserve immutability during batch operations', async () => {
      const { result } = renderHook(() => useReactiveStore());

      const batchEntries = [
        {
          title: 'Batch Entry 1',
          problem: 'Problem 1',
          solution: 'Solution 1',
          category: 'JCL' as const,
          tags: ['batch1'],
        },
        {
          title: 'Batch Entry 2',
          problem: 'Problem 2',
          solution: 'Solution 2',
          category: 'VSAM' as const,
          tags: ['batch2'],
        },
      ];

      const createdEntries = batchEntries.map((entry, index) => ({
        ...entry,
        id: `batch-${index}`,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
      }));

      mockElectronAPI.addKBEntry.mockImplementation((entry, index) =>
        Promise.resolve(createdEntries[batchEntries.findIndex(e => e.title === entry.title)])
      );

      const initialEntries = result.current.entries;

      await act(async () => {
        await result.current.createEntries(batchEntries);
      });

      // Original entries Map should not be mutated
      expect(initialEntries.size).toBe(0);
      expect(result.current.entries.size).toBe(2);

      // Verify immutability of created entries
      const violations = attemptNestedMutation(result.current);
      expect(violations).toHaveLength(0);
    });
  });

  describe('Selector Immutability', () => {
    it('should return immutable data from selectors', () => {
      const { result } = renderHook(() => useReactiveStore());

      const mockEntry = generateMockEntry('selector-test');
      act(() => {
        useReactiveStore.setState({
          entries: new Map([['selector-test', mockEntry]]),
          isLoading: true,
          errors: new Map([['test-error', {
            code: 'TEST',
            message: 'Test error',
            timestamp: Date.now(),
          }]]),
        });
      });

      // Test selectors
      const entries = selectEntries(result.current);
      const loading = selectLoading(result.current);
      const errors = selectErrors(result.current);
      const metrics = selectMetrics(result.current);
      const filters = selectFilters(result.current);
      const pagination = selectPagination(result.current);

      // Attempt to mutate selector results
      try {
        (entries as any).set('mutation-test', { invalid: 'data' });
        throw new Error('Entries selector mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Entries selector mutation should have been prevented');
      }

      try {
        (errors as any).set('mutation-test', { invalid: 'error' });
        throw new Error('Errors selector mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Errors selector mutation should have been prevented');
      }

      try {
        (metrics as any).totalOperations = 999;
        throw new Error('Metrics selector mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Metrics selector mutation should have been prevented');
      }

      try {
        (filters as any).invalidProperty = 'invalid';
        throw new Error('Filters selector mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Filters selector mutation should have been prevented');
      }

      try {
        (pagination as any).currentPage = 999;
        throw new Error('Pagination selector mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Pagination selector mutation should have been prevented');
      }
    });

    it('should maintain selector reference stability for unchanged data', () => {
      const { result } = renderHook(() => useReactiveStore());

      const initialEntries = selectEntries(result.current);
      const initialMetrics = selectMetrics(result.current);
      const initialPagination = selectPagination(result.current);

      // Update unrelated state
      act(() => {
        result.current.updateFilters({ search: 'test query' });
      });

      const updatedEntries = selectEntries(result.current);
      const updatedMetrics = selectMetrics(result.current);
      const updatedPagination = selectPagination(result.current);

      // Unchanged selectors should return same references
      expect(updatedEntries).toBe(initialEntries);
      expect(updatedMetrics).toBe(initialMetrics);
      expect(updatedPagination).toBe(initialPagination);
    });
  });

  describe('Array and Collection Immutability', () => {
    it('should prevent mutation of category arrays', () => {
      const { result } = renderHook(() => useReactiveStore());

      const categories = result.current.categories;

      try {
        (categories as any).push('INVALID_CATEGORY');
        throw new Error('Categories array mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Categories array mutation should have been prevented');
      }

      try {
        (categories as any)[0] = 'MUTATED_CATEGORY';
        throw new Error('Categories array element mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Categories array element mutation should have been prevented');
      }
    });

    it('should maintain immutability of sync queue arrays', () => {
      const { result } = renderHook(() => useReactiveStore());

      const mockSyncItem = {
        operation: {
          id: 'op-1',
          type: 'create' as const,
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          optimistic: true,
        },
        data: { title: 'Test' },
        resolve: () => {},
        reject: () => {},
      };

      act(() => {
        useReactiveStore.setState({
          syncQueue: [mockSyncItem],
        });
      });

      const syncQueue = result.current.syncQueue;

      try {
        (syncQueue as any).push({ invalid: 'item' });
        throw new Error('Sync queue mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Sync queue mutation should have been prevented');
      }

      try {
        (syncQueue[0].operation as any).retryCount = 999;
        throw new Error('Sync queue item mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Sync queue item mutation should have been prevented');
      }
    });

    it('should enforce immutability on entry tag arrays', () => {
      const { result } = renderHook(() => useReactiveStore());

      const mockEntry = generateMockEntry('tag-test', {
        tags: ['tag1', 'tag2', 'tag3'],
      });

      act(() => {
        useReactiveStore.setState({
          entries: new Map([['tag-test', mockEntry]]),
        });
      });

      const entry = result.current.entries.get('tag-test');
      const tags = entry!.tags;

      try {
        (tags as any).push('INVALID_TAG');
        throw new Error('Tags array mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Tags array mutation should have been prevented');
      }

      try {
        (tags as any)[0] = 'MUTATED_TAG';
        throw new Error('Tags array element mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Tags array element mutation should have been prevented');
      }
    });
  });

  describe('Performance Impact Assessment', () => {
    it('should maintain reasonable performance with immutability enforcement', () => {
      const { result } = renderHook(() => useReactiveStore());

      const entryCount = 1000;
      const entries = Array.from({ length: entryCount }, (_, i) =>
        generateMockEntry(`perf-entry-${i}`)
      );

      const startTime = performance.now();

      act(() => {
        useReactiveStore.setState({
          entries: new Map(entries.map(e => [e.id, e])),
        });
      });

      const endTime = performance.now();
      const updateTime = endTime - startTime;

      // Should complete within reasonable time (less than 100ms for 1000 entries)
      expect(updateTime).toBeLessThan(100);

      // Verify immutability is still enforced
      const violations = attemptDirectMutation(result.current);
      expect(violations).toHaveLength(0);
    });

    it('should efficiently handle frequent small updates', () => {
      const { result } = renderHook(() => useReactiveStore());

      const updateCount = 100;
      const startTime = performance.now();

      // Perform many small updates
      for (let i = 0; i < updateCount; i++) {
        act(() => {
          result.current.updateFilters({ search: `query-${i}` });
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should average less than 5ms per update
      expect(totalTime / updateCount).toBeLessThan(5);

      // Immutability should still be enforced
      const violations = attemptDirectMutation(result.current);
      expect(violations).toHaveLength(0);
    });

    it('should manage memory efficiently with immutable structures', () => {
      const { result } = renderHook(() => useReactiveStore());

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Create and update many entries
      for (let i = 0; i < 100; i++) {
        const entries = Array.from({ length: 10 }, (_, j) =>
          generateMockEntry(`batch-${i}-entry-${j}`)
        );

        act(() => {
          useReactiveStore.setState({
            entries: new Map(entries.map(e => [e.id, e])),
          });
        });

        // Trigger some updates
        act(() => {
          result.current.updateFilters({ category: i % 2 === 0 ? 'JCL' : 'VSAM' });
        });
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Error State Immutability', () => {
    it('should maintain immutability during error handling', () => {
      const { result } = renderHook(() => useReactiveStore());

      const errorId = 'immutable-error';
      const errorData = {
        code: 'IMMUTABILITY_TEST',
        message: 'Test error for immutability',
        timestamp: Date.now(),
        operation: {
          id: 'op-1',
          type: 'create' as const,
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          optimistic: true,
        },
      };

      act(() => {
        useReactiveStore.setState({
          errors: new Map([[errorId, errorData]]),
        });
      });

      const error = result.current.errors.get(errorId);
      expect(error).toBeTruthy();

      // Attempt to mutate error data
      try {
        (error!.operation as any).retryCount = 999;
        throw new Error('Error operation mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Error operation mutation should have been prevented');
      }

      try {
        (error as any).message = 'MUTATED_MESSAGE';
        throw new Error('Error message mutation should have been prevented');
      } catch (error) {
        expect(error.message).not.toBe('Error message mutation should have been prevented');
      }
    });

    it('should preserve immutability when clearing errors', () => {
      const { result } = renderHook(() => useReactiveStore());

      const initialErrors = new Map([
        ['error-1', { code: 'E1', message: 'Error 1', timestamp: Date.now() }],
        ['error-2', { code: 'E2', message: 'Error 2', timestamp: Date.now() }],
      ]);

      act(() => {
        useReactiveStore.setState({ errors: initialErrors });
      });

      const errorsBeforeClear = result.current.errors;

      act(() => {
        result.current.clearError('error-1');
      });

      // Original errors Map should not be mutated
      expect(initialErrors.size).toBe(2);
      expect(errorsBeforeClear.size).toBe(2);
      expect(result.current.errors.size).toBe(1);

      // Maps should be different instances
      expect(result.current.errors).not.toBe(errorsBeforeClear);
    });
  });

  describe('Optimistic Operations Immutability', () => {
    it('should maintain immutability during optimistic updates', async () => {
      const { result } = renderHook(() => useReactiveStore());

      const entryInput = {
        title: 'Optimistic Entry',
        problem: 'Optimistic problem',
        solution: 'Optimistic solution',
        category: 'JCL' as const,
        tags: ['optimistic'],
      };

      const createdEntry = {
        ...entryInput,
        id: 'optimistic-entry',
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
      };

      mockElectronAPI.addKBEntry.mockResolvedValue(createdEntry);

      const initialOperations = result.current.optimisticOperations;

      await act(async () => {
        await result.current.createEntry(entryInput, true);
      });

      // Original operations Map should not be mutated
      expect(initialOperations.size).toBe(0);
      expect(result.current.optimisticOperations.size).toBe(0); // Should be cleared after success

      // Verify immutability is maintained
      const violations = attemptDirectMutation(result.current);
      expect(violations).toHaveLength(0);
    });

    it('should preserve immutability during rollback operations', () => {
      const { result } = renderHook(() => useReactiveStore());

      const operationId = 'rollback-test';
      const originalEntry = generateMockEntry('rollback-entry');
      const rollbackData = { ...originalEntry };

      act(() => {
        useReactiveStore.setState({
          entries: new Map([['rollback-entry', { ...originalEntry, title: 'Modified Title' }]]),
          optimisticOperations: new Map([[operationId, {
            id: operationId,
            type: 'update',
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: 3,
            optimistic: true,
          }]]),
          rollbackData: new Map([[operationId, rollbackData]]),
        });
      });

      const entriesBeforeRollback = result.current.entries;
      const operationsBeforeRollback = result.current.optimisticOperations;

      act(() => {
        result.current.rollbackOptimisticOperation(operationId);
      });

      // Original collections should not be mutated
      expect(entriesBeforeRollback.get('rollback-entry')?.title).toBe('Modified Title');
      expect(operationsBeforeRollback.has(operationId)).toBe(true);

      // New state should reflect rollback
      expect(result.current.entries.get('rollback-entry')?.title).toBe(originalEntry.title);
      expect(result.current.optimisticOperations.has(operationId)).toBe(false);

      // Collections should be different instances
      expect(result.current.entries).not.toBe(entriesBeforeRollback);
      expect(result.current.optimisticOperations).not.toBe(operationsBeforeRollback);
    });
  });
});