/**
 * KBDataContext State Synchronization Tests
 *
 * Comprehensive test suite for KB data state synchronization and coordination:
 * - Multi-provider state synchronization
 * - Cross-tab state consistency
 * - Real-time update propagation
 * - Conflict resolution mechanisms
 * - Offline/online state reconciliation
 * - Batch operation coordination
 * - Cache consistency across instances
 * - IPC synchronization with main process
 * - Data integrity validation
 * - Performance under load
 *
 * @author State Management Testing Specialist
 * @version 2.0.0
 */

import React, { useRef, useEffect, useState, createContext, useContext } from 'react';
import { render, renderHook, act, waitFor, screen } from '@testing-library/react';
import { KBDataProvider, useKBData, KBDataState, KBDataContextValue } from '../../src/renderer/contexts/KBDataContext';
import { KBEntry, KBEntryInput, KBEntryUpdate, KBCategory } from '../../src/types/services';

// Mock timers for testing
jest.useFakeTimers();

// Enhanced mock electronAPI with synchronization simulation
interface MockElectronAPI {
  getKBEntries: jest.Mock;
  getKBEntry: jest.Mock;
  addKBEntry: jest.Mock;
  updateKBEntry: jest.Mock;
  deleteKBEntry: jest.Mock;
  rateKBEntry: jest.Mock;
  recordEntryView: jest.Mock;

  // Synchronization events
  onDataSync: jest.Mock;
  emitDataSync: jest.Mock;
  subscribeToUpdates: jest.Mock;
  unsubscribeFromUpdates: jest.Mock;

  // Performance simulation
  _operationDelay: number;
  _conflictRate: number;
  _networkFailureRate: number;

  setOperationDelay: (delay: number) => void;
  setConflictRate: (rate: number) => void;
  setNetworkFailureRate: (rate: number) => void;
  simulateNetworkPartition: (duration: number) => void;
  reset: () => void;
}

const createMockElectronAPI = (): MockElectronAPI => {
  const api = {
    getKBEntries: jest.fn(),
    getKBEntry: jest.fn(),
    addKBEntry: jest.fn(),
    updateKBEntry: jest.fn(),
    deleteKBEntry: jest.fn(),
    rateKBEntry: jest.fn(),
    recordEntryView: jest.fn(),

    onDataSync: jest.fn(),
    emitDataSync: jest.fn(),
    subscribeToUpdates: jest.fn(),
    unsubscribeFromUpdates: jest.fn(),

    _operationDelay: 0,
    _conflictRate: 0,
    _networkFailureRate: 0,

    setOperationDelay: (delay: number) => { api._operationDelay = delay; },
    setConflictRate: (rate: number) => { api._conflictRate = rate; },
    setNetworkFailureRate: (rate: number) => { api._networkFailureRate = rate; },
    simulateNetworkPartition: (duration: number) => {
      api._networkFailureRate = 1.0;
      setTimeout(() => { api._networkFailureRate = 0; }, duration);
    },
    reset: () => {
      api._operationDelay = 0;
      api._conflictRate = 0;
      api._networkFailureRate = 0;
    },
  };

  // Simulate realistic API responses
  const createAsyncResponse = <T>(response: T, shouldFail = false): Promise<T> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (shouldFail || Math.random() < api._networkFailureRate) {
          reject(new Error('Network operation failed'));
        } else if (Math.random() < api._conflictRate) {
          reject(new Error('Conflict detected - version mismatch'));
        } else {
          resolve(response);
        }
      }, api._operationDelay);
    });
  };

  api.getKBEntries.mockImplementation((options) =>
    createAsyncResponse({ entries: [], total: 0 })
  );

  api.addKBEntry.mockImplementation((entry: KBEntryInput) =>
    createAsyncResponse({
      ...entry,
      id: `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date(),
      updated_at: new Date(),
      usage_count: 0,
      success_count: 0,
      failure_count: 0,
    })
  );

  api.updateKBEntry.mockImplementation((id: string, updates: KBEntryUpdate) =>
    createAsyncResponse({
      id,
      title: 'Updated Entry',
      problem: 'Updated problem',
      solution: 'Updated solution',
      category: 'VSAM' as KBCategory,
      tags: ['updated'],
      created_at: new Date(),
      updated_at: new Date(),
      usage_count: 1,
      success_count: 1,
      failure_count: 0,
      ...updates,
    })
  );

  api.deleteKBEntry.mockImplementation((id: string) =>
    createAsyncResponse(undefined)
  );

  return api;
};

// Global instances for cross-provider testing
const mockElectronAPI1 = createMockElectronAPI();
const mockElectronAPI2 = createMockElectronAPI();

// @ts-ignore
global.window.electronAPI = mockElectronAPI1;

// Test data generators
const generateMockEntry = (id: string, overrides: Partial<KBEntry> = {}): KBEntry => ({
  id,
  title: `Test Entry ${id}`,
  problem: `Problem description for ${id}`,
  solution: `Solution for ${id}`,
  category: 'VSAM',
  tags: ['test', 'mock'],
  created_at: new Date(),
  updated_at: new Date(),
  usage_count: 0,
  success_count: 0,
  failure_count: 0,
  ...overrides,
});

const generateMockEntries = (count: number): KBEntry[] => {
  return Array.from({ length: count }, (_, i) => generateMockEntry(`entry-${i}`));
};

// Cross-tab synchronization simulation
interface SyncEvent {
  type: 'create' | 'update' | 'delete' | 'batch';
  entryId?: string;
  entryIds?: string[];
  data?: any;
  timestamp: number;
  source: string;
}

class CrossTabSyncManager {
  private listeners: Array<(event: SyncEvent) => void> = [];
  private eventHistory: SyncEvent[] = [];

  emit(event: Omit<SyncEvent, 'timestamp'>) {
    const fullEvent: SyncEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.eventHistory.push(fullEvent);

    // Simulate slight delay for cross-tab events
    setTimeout(() => {
      this.listeners.forEach(listener => listener(fullEvent));
    }, 10);
  }

  subscribe(listener: (event: SyncEvent) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getEventHistory(): SyncEvent[] {
    return [...this.eventHistory];
  }

  clearHistory() {
    this.eventHistory = [];
  }
}

const crossTabSync = new CrossTabSyncManager();

// Synchronization-aware test wrapper
interface SyncTestWrapperOptions {
  instanceId: string;
  initialState?: Partial<KBDataState>;
  enableCrossTabSync?: boolean;
  enableRealTimeSync?: boolean;
  mockAPI?: MockElectronAPI;
}

const createSyncTestWrapper = (options: SyncTestWrapperOptions) => {
  const {
    instanceId,
    initialState,
    enableCrossTabSync = true,
    enableRealTimeSync = true,
    mockAPI = mockElectronAPI1,
  } = options;

  return ({ children }: { children: React.ReactNode }) => {
    // Override global electronAPI for this instance
    const originalAPI = (global.window as any).electronAPI;
    (global.window as any).electronAPI = mockAPI;

    useEffect(() => {
      return () => {
        (global.window as any).electronAPI = originalAPI;
      };
    }, []);

    return (
      <KBDataProvider initialState={initialState}>
        {enableCrossTabSync && (
          <CrossTabSyncHandler instanceId={instanceId} />
        )}
        {enableRealTimeSync && (
          <RealTimeSyncHandler instanceId={instanceId} />
        )}
        {children}
      </KBDataProvider>
    );
  };
};

// Cross-tab synchronization handler component
const CrossTabSyncHandler = ({ instanceId }: { instanceId: string }) => {
  const kbData = useKBData();

  useEffect(() => {
    const unsubscribe = crossTabSync.subscribe((event) => {
      if (event.source === instanceId) return; // Don't sync our own events

      // Handle different sync events
      switch (event.type) {
        case 'create':
          if (event.data) {
            // Simulate receiving create event from another tab
            kbData.state.entries.set(event.data.id, event.data);
          }
          break;
        case 'update':
          if (event.entryId && event.data) {
            kbData.state.entries.set(event.entryId, event.data);
          }
          break;
        case 'delete':
          if (event.entryId) {
            kbData.state.entries.delete(event.entryId);
          }
          break;
        case 'batch':
          // Handle batch operations
          break;
      }
    });

    return unsubscribe;
  }, [kbData, instanceId]);

  return null;
};

// Real-time synchronization handler component
const RealTimeSyncHandler = ({ instanceId }: { instanceId: string }) => {
  const kbData = useKBData();

  useEffect(() => {
    // Mock subscription to real-time updates
    const handleRealTimeUpdate = (event: any) => {
      // Simulate real-time updates from server
      console.log(`Real-time update received in ${instanceId}:`, event);
    };

    // Mock IPC subscription
    if ((window as any).electronAPI?.subscribeToUpdates) {
      (window as any).electronAPI.subscribeToUpdates(handleRealTimeUpdate);
    }

    return () => {
      if ((window as any).electronAPI?.unsubscribeFromUpdates) {
        (window as any).electronAPI.unsubscribeFromUpdates(handleRealTimeUpdate);
      }
    };
  }, [instanceId]);

  return null;
};

// Conflict simulation utilities
interface ConflictScenario {
  name: string;
  setup: () => Promise<void>;
  operations: Array<{
    instanceId: string;
    operation: () => Promise<any>;
    expectedOutcome: 'success' | 'conflict' | 'error';
  }>;
  resolution: () => Promise<void>;
}

const createConflictScenario = (scenario: ConflictScenario) => scenario;

describe('KBDataContext - State Synchronization Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    crossTabSync.clearHistory();
    mockElectronAPI1.reset();
    mockElectronAPI2.reset();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe('Multi-Provider State Synchronization', () => {
    it('should synchronize state between multiple provider instances', async () => {
      const { result: result1 } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'instance-1' }),
      });

      const { result: result2 } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({
          instanceId: 'instance-2',
          mockAPI: mockElectronAPI2,
        }),
      });

      // Load data in first instance
      const mockEntries = generateMockEntries(3);
      mockElectronAPI1.getKBEntries.mockResolvedValue({
        entries: mockEntries,
        total: 3,
      });

      await act(async () => {
        await result1.current.loadEntries();
      });

      expect(result1.current.state.entries.size).toBe(3);

      // Simulate cross-tab sync
      act(() => {
        crossTabSync.emit({
          type: 'batch',
          data: mockEntries,
          source: 'instance-1',
        });
      });

      await waitFor(() => {
        expect(result2.current.state.entries.size).toBe(3);
      });
    });

    it('should handle concurrent operations across instances', async () => {
      const { result: result1 } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'instance-1' }),
      });

      const { result: result2 } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({
          instanceId: 'instance-2',
          mockAPI: mockElectronAPI2,
        }),
      });

      const entryInput1: KBEntryInput = {
        title: 'Entry from Instance 1',
        problem: 'Problem 1',
        solution: 'Solution 1',
        category: 'JCL',
        tags: ['test1'],
      };

      const entryInput2: KBEntryInput = {
        title: 'Entry from Instance 2',
        problem: 'Problem 2',
        solution: 'Solution 2',
        category: 'VSAM',
        tags: ['test2'],
      };

      // Concurrent creates
      const [created1, created2] = await Promise.all([
        act(async () => await result1.current.createEntry(entryInput1)),
        act(async () => await result2.current.createEntry(entryInput2)),
      ]);

      expect(created1.title).toBe('Entry from Instance 1');
      expect(created2.title).toBe('Entry from Instance 2');

      // Simulate sync events
      act(() => {
        crossTabSync.emit({
          type: 'create',
          entryId: created1.id,
          data: created1,
          source: 'instance-1',
        });

        crossTabSync.emit({
          type: 'create',
          entryId: created2.id,
          data: created2,
          source: 'instance-2',
        });
      });

      await waitFor(() => {
        expect(result1.current.state.entries.size).toBe(2);
        expect(result2.current.state.entries.size).toBe(2);
      });
    });
  });

  describe('Conflict Resolution Mechanisms', () => {
    it('should detect and resolve version conflicts', async () => {
      const conflictScenario = createConflictScenario({
        name: 'Concurrent Update Conflict',
        setup: async () => {
          const baseEntry = generateMockEntry('conflict-entry');
          mockElectronAPI1.getKBEntries.mockResolvedValue({
            entries: [baseEntry],
            total: 1,
          });
          mockElectronAPI2.getKBEntries.mockResolvedValue({
            entries: [baseEntry],
            total: 1,
          });
        },
        operations: [
          {
            instanceId: 'instance-1',
            operation: async () => {
              // Simulate update in instance 1
              mockElectronAPI1.setConflictRate(0.5); // 50% conflict rate
              return { title: 'Updated by Instance 1' };
            },
            expectedOutcome: 'conflict',
          },
          {
            instanceId: 'instance-2',
            operation: async () => {
              // Simulate conflicting update in instance 2
              mockElectronAPI2.setConflictRate(0.5);
              return { title: 'Updated by Instance 2' };
            },
            expectedOutcome: 'conflict',
          },
        ],
        resolution: async () => {
          // Implement conflict resolution strategy
          // For this test, we'll use "last write wins"
        },
      });

      const { result: result1 } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'instance-1' }),
      });

      const { result: result2 } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({
          instanceId: 'instance-2',
          mockAPI: mockElectronAPI2,
        }),
      });

      await conflictScenario.setup();

      // Load initial data
      await act(async () => {
        await result1.current.loadEntries();
        await result2.current.loadEntries();
      });

      // Attempt concurrent updates
      const updates1 = conflictScenario.operations[0].operation();
      const updates2 = conflictScenario.operations[1].operation();

      const [outcome1, outcome2] = await Promise.allSettled([
        act(async () => {
          try {
            return await result1.current.updateEntry('conflict-entry', await updates1);
          } catch (error) {
            return { error: error.message };
          }
        }),
        act(async () => {
          try {
            return await result2.current.updateEntry('conflict-entry', await updates2);
          } catch (error) {
            return { error: error.message };
          }
        }),
      ]);

      // At least one should detect conflict
      const hasConflict = [outcome1, outcome2].some(outcome =>
        outcome.status === 'rejected' ||
        (outcome.status === 'fulfilled' && (outcome.value as any)?.error?.includes('Conflict'))
      );

      expect(hasConflict).toBe(true);
    });

    it('should implement last-write-wins conflict resolution', async () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'test-instance' }),
      });

      const baseEntry = generateMockEntry('lww-entry', {
        title: 'Original Title',
        updated_at: new Date('2024-01-01T10:00:00Z'),
      });

      // Setup initial state
      await act(async () => {
        result.current.state.entries.set('lww-entry', baseEntry);
      });

      // Simulate receiving conflicting updates with different timestamps
      const earlierUpdate = {
        ...baseEntry,
        title: 'Earlier Update',
        updated_at: new Date('2024-01-01T10:30:00Z'),
      };

      const laterUpdate = {
        ...baseEntry,
        title: 'Later Update',
        updated_at: new Date('2024-01-01T11:00:00Z'),
      };

      // Apply updates in reverse chronological order
      act(() => {
        crossTabSync.emit({
          type: 'update',
          entryId: 'lww-entry',
          data: laterUpdate,
          source: 'remote-instance-1',
        });
      });

      act(() => {
        crossTabSync.emit({
          type: 'update',
          entryId: 'lww-entry',
          data: earlierUpdate,
          source: 'remote-instance-2',
        });
      });

      await waitFor(() => {
        const finalEntry = result.current.getEntry('lww-entry');
        expect(finalEntry?.title).toBe('Later Update'); // Later timestamp should win
      });
    });
  });

  describe('Offline/Online State Reconciliation', () => {
    it('should queue operations during offline mode', async () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'offline-test' }),
      });

      // Simulate network partition
      mockElectronAPI1.simulateNetworkPartition(2000);

      const offlineEntry: KBEntryInput = {
        title: 'Offline Entry',
        problem: 'Created while offline',
        solution: 'Should be queued',
        category: 'JCL',
        tags: ['offline'],
      };

      // Attempt to create entry while offline
      let createError: Error | null = null;
      await act(async () => {
        try {
          await result.current.createEntry(offlineEntry);
        } catch (error) {
          createError = error as Error;
        }
      });

      expect(createError?.message).toContain('Network operation failed');

      // Restore network connectivity
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      // Retry the operation
      await act(async () => {
        await result.current.createEntry(offlineEntry);
      });

      expect(result.current.state.entries.size).toBe(1);
    });

    it('should reconcile state after network recovery', async () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'recovery-test' }),
      });

      const entriesBeforePartition = generateMockEntries(3);
      const entriesDuringPartition = generateMockEntries(2);

      // Load initial data
      mockElectronAPI1.getKBEntries.mockResolvedValue({
        entries: entriesBeforePartition,
        total: 3,
      });

      await act(async () => {
        await result.current.loadEntries();
      });

      expect(result.current.state.entries.size).toBe(3);

      // Simulate network partition
      mockElectronAPI1.simulateNetworkPartition(1000);

      // Simulate receiving updates from other instances during partition
      act(() => {
        entriesDuringPartition.forEach(entry => {
          crossTabSync.emit({
            type: 'create',
            entryId: entry.id,
            data: entry,
            source: 'remote-instance',
          });
        });
      });

      // Network recovery - reconcile state
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Trigger reconciliation
      await act(async () => {
        await result.current.refreshEntries();
      });

      // Should have all entries from before and during partition
      expect(result.current.state.entries.size).toBe(5);
    });
  });

  describe('Batch Operation Coordination', () => {
    it('should coordinate batch operations across instances', async () => {
      const { result: result1 } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'batch-1' }),
      });

      const { result: result2 } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({
          instanceId: 'batch-2',
          mockAPI: mockElectronAPI2,
        }),
      });

      const batchEntries: KBEntryInput[] = [
        {
          title: 'Batch Entry 1',
          problem: 'Problem 1',
          solution: 'Solution 1',
          category: 'JCL',
          tags: ['batch'],
        },
        {
          title: 'Batch Entry 2',
          problem: 'Problem 2',
          solution: 'Solution 2',
          category: 'VSAM',
          tags: ['batch'],
        },
      ];

      // Perform batch create in instance 1
      const createdEntries = await act(async () => {
        return await result1.current.createEntries(batchEntries);
      });

      expect(createdEntries).toHaveLength(2);
      expect(result1.current.state.entries.size).toBe(2);

      // Simulate batch sync to instance 2
      act(() => {
        crossTabSync.emit({
          type: 'batch',
          data: createdEntries,
          source: 'batch-1',
        });
      });

      await waitFor(() => {
        expect(result2.current.state.entries.size).toBe(2);
      });
    });

    it('should handle partial batch operation failures', async () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'partial-batch' }),
      });

      // Mock some operations to fail
      let callCount = 0;
      mockElectronAPI1.addKBEntry.mockImplementation((entry: KBEntryInput) => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Second entry failed'));
        }
        return Promise.resolve({
          ...entry,
          id: `entry-${callCount}`,
          created_at: new Date(),
          updated_at: new Date(),
          usage_count: 0,
          success_count: 0,
          failure_count: 0,
        });
      });

      const batchEntries: KBEntryInput[] = [
        { title: 'Entry 1', problem: 'P1', solution: 'S1', category: 'JCL', tags: [] },
        { title: 'Entry 2', problem: 'P2', solution: 'S2', category: 'VSAM', tags: [] },
        { title: 'Entry 3', problem: 'P3', solution: 'S3', category: 'DB2', tags: [] },
      ];

      let batchError: Error | null = null;
      let createdEntries: any[] = [];

      await act(async () => {
        try {
          createdEntries = await result.current.createEntries(batchEntries);
        } catch (error) {
          batchError = error as Error;
        }
      });

      // Should have partial success
      expect(batchError).toBeTruthy();
      expect(createdEntries).toHaveLength(2); // Only successful entries
      expect(result.current.state.entries.size).toBe(2);
    });
  });

  describe('Cache Consistency Across Instances', () => {
    it('should invalidate cache across instances on updates', async () => {
      const { result: result1 } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'cache-1' }),
      });

      const { result: result2 } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({
          instanceId: 'cache-2',
          mockAPI: mockElectronAPI2,
        }),
      });

      const entry = generateMockEntry('cache-entry');

      // Load and cache entry in both instances
      mockElectronAPI1.getKBEntries.mockResolvedValue({
        entries: [entry],
        total: 1,
      });
      mockElectronAPI2.getKBEntries.mockResolvedValue({
        entries: [entry],
        total: 1,
      });

      await act(async () => {
        await result1.current.loadEntries();
        await result2.current.loadEntries();
      });

      expect(result1.current.state.cacheStatus).toBe('fresh');
      expect(result2.current.state.cacheStatus).toBe('fresh');

      // Update entry in instance 1
      const updatedEntry = await act(async () => {
        return await result1.current.updateEntry('cache-entry', { title: 'Updated Title' });
      });

      // Simulate cache invalidation sync
      act(() => {
        crossTabSync.emit({
          type: 'update',
          entryId: 'cache-entry',
          data: updatedEntry,
          source: 'cache-1',
        });
      });

      // Instance 2 cache should be invalidated
      await waitFor(() => {
        expect(result2.current.state.cacheStatus).toBe('stale');
      });
    });

    it('should maintain cache consistency during concurrent access', async () => {
      const instances = Array.from({ length: 5 }, (_, i) => ({
        id: `cache-instance-${i}`,
        result: renderHook(() => useKBData(), {
          wrapper: createSyncTestWrapper({ instanceId: `cache-instance-${i}` }),
        }).result,
      }));

      const entry = generateMockEntry('concurrent-cache-entry');

      // Load same entry in all instances
      const loadPromises = instances.map(({ result }) =>
        act(async () => {
          await result.current.loadEntries();
        })
      );

      await Promise.all(loadPromises);

      // All instances should have consistent cache status
      instances.forEach(({ result }) => {
        expect(result.current.state.cacheStatus).toBe('fresh');
      });

      // Update entry from one instance
      const updatedEntry = await act(async () => {
        return await instances[0].result.current.updateEntry('concurrent-cache-entry', {
          title: 'Concurrently Updated',
        });
      });

      // Broadcast update to all other instances
      act(() => {
        crossTabSync.emit({
          type: 'update',
          entryId: 'concurrent-cache-entry',
          data: updatedEntry,
          source: 'cache-instance-0',
        });
      });

      // All other instances should have updated state
      await waitFor(() => {
        instances.slice(1).forEach(({ result }) => {
          const entry = result.current.getEntry('concurrent-cache-entry');
          expect(entry?.title).toBe('Concurrently Updated');
        });
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({
          instanceId: 'performance-test',
          enableCrossTabSync: true,
        }),
      });

      const updateCount = 1000;
      const startTime = performance.now();

      // Generate high-frequency updates
      const updates = Array.from({ length: updateCount }, (_, i) => ({
        type: 'update' as const,
        entryId: `perf-entry-${i % 10}`, // Update 10 entries repeatedly
        data: generateMockEntry(`perf-entry-${i % 10}`, { title: `Update ${i}` }),
        source: 'external-instance',
      }));

      // Batch process updates
      act(() => {
        updates.forEach(update => {
          crossTabSync.emit(update);
        });
      });

      await waitFor(() => {
        expect(result.current.state.entries.size).toBeGreaterThan(0);
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should process updates efficiently (less than 1ms per update on average)
      expect(processingTime / updateCount).toBeLessThan(1);
    });

    it('should maintain memory efficiency during extended sync sessions', async () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'memory-test' }),
      });

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Simulate extended sync session
      for (let batch = 0; batch < 10; batch++) {
        const batchEntries = generateMockEntries(100);

        // Process batch
        act(() => {
          batchEntries.forEach(entry => {
            crossTabSync.emit({
              type: 'create',
              entryId: entry.id,
              data: entry,
              source: 'memory-stress-test',
            });
          });
        });

        // Force periodic cleanup
        if (batch % 3 === 0) {
          act(() => {
            result.current.invalidateCache();
          });
        }

        await act(async () => {
          jest.advanceTimersByTime(100);
        });
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Data Integrity Validation', () => {
    it('should validate data integrity during sync operations', async () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'integrity-test' }),
      });

      const validEntry = generateMockEntry('valid-entry');
      const invalidEntry = {
        ...generateMockEntry('invalid-entry'),
        id: '', // Invalid ID
        title: '', // Invalid title
      };

      // Process valid and invalid sync events
      act(() => {
        crossTabSync.emit({
          type: 'create',
          entryId: validEntry.id,
          data: validEntry,
          source: 'valid-source',
        });

        crossTabSync.emit({
          type: 'create',
          entryId: invalidEntry.id,
          data: invalidEntry,
          source: 'invalid-source',
        });
      });

      await waitFor(() => {
        // Only valid entry should be accepted
        expect(result.current.getEntry('valid-entry')).toBeTruthy();
        expect(result.current.getEntry('invalid-entry')).toBeNull();
        expect(result.current.state.entries.size).toBe(1);
      });
    });

    it('should detect and prevent circular sync loops', async () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createSyncTestWrapper({ instanceId: 'loop-prevention' }),
      });

      const entry = generateMockEntry('loop-entry');

      // Simulate circular sync (should be prevented)
      const syncEvents = [
        { source: 'instance-1', target: 'instance-2' },
        { source: 'instance-2', target: 'instance-3' },
        { source: 'instance-3', target: 'instance-1' }, // Creates loop
      ];

      // Process sync events
      act(() => {
        syncEvents.forEach(({ source }) => {
          crossTabSync.emit({
            type: 'update',
            entryId: entry.id,
            data: { ...entry, title: `Updated by ${source}` },
            source,
          });
        });
      });

      // Should process updates but prevent infinite loops
      const eventHistory = crossTabSync.getEventHistory();
      const updateEvents = eventHistory.filter(e => e.type === 'update' && e.entryId === entry.id);

      expect(updateEvents.length).toBe(3);
      expect(result.current.state.entries.size).toBe(1);
    });
  });
});