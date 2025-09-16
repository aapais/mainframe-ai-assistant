/**
 * Reactive State Store Tests
 * Comprehensive test suite for reactive data layer
 *
 * @author Test Coordinator
 * @version 1.0.0
 */

import { act, renderHook } from '@testing-library/react';
import { useReactiveStore } from '../reactive-state';
import { KBEntry, KBEntryInput, KBEntryUpdate } from '../../../types';

// Mock window.electronAPI
const mockElectronAPI = {
  getKBEntries: jest.fn(),
  addKBEntry: jest.fn(),
  updateKBEntry: jest.fn(),
  deleteKBEntry: jest.fn(),
  getKBEntry: jest.fn(),
  rateKBEntry: jest.fn(),
  recordEntryView: jest.fn(),
  ping: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Test data
const mockEntry: KBEntry = {
  id: 'test-1',
  title: 'Test Entry',
  problem: 'Test problem description',
  solution: 'Test solution description',
  category: 'JCL',
  tags: ['test', 'example'],
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  usage_count: 0,
  success_count: 0,
  failure_count: 0,
};

const mockEntryInput: KBEntryInput = {
  title: 'New Entry',
  problem: 'New problem description',
  solution: 'New solution description',
  category: 'VSAM',
  tags: ['new', 'test'],
};

const mockEntryUpdate: KBEntryUpdate = {
  title: 'Updated Entry',
  solution: 'Updated solution description',
  tags: ['updated', 'test'],
};

describe('Reactive State Store', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset store state
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

  describe('Load Entries', () => {
    it('should load entries successfully', async () => {
      const entries = [mockEntry];
      mockElectronAPI.getKBEntries.mockResolvedValue({ entries, total: 1 });

      const { result } = renderHook(() => useReactiveStore());

      await act(async () => {
        await result.current.loadEntries();
      });

      expect(result.current.entries.size).toBe(1);
      expect(result.current.entries.get('test-1')).toEqual(mockEntry);
      expect(result.current.isLoading).toBe(false);
      expect(mockElectronAPI.getKBEntries).toHaveBeenCalled();
    });

    it('should handle load errors', async () => {
      const error = new Error('Load failed');
      mockElectronAPI.getKBEntries.mockRejectedValue(error);

      const { result } = renderHook(() => useReactiveStore());

      await act(async () => {
        try {
          await result.current.loadEntries();
        } catch (e) {
          expect(e).toBe(error);
        }
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.errors.size).toBe(1);
      expect(result.current.metrics.failedOperations).toBe(1);
    });

    it('should skip loading if data is fresh', async () => {
      const { result } = renderHook(() => useReactiveStore());

      // Set recent sync timestamp
      act(() => {
        useReactiveStore.setState({
          lastSyncTimestamp: Date.now() - 30000, // 30 seconds ago
          entries: new Map([['test-1', mockEntry]]),
        });
      });

      const entriesBefore = Array.from(result.current.entries.values());

      await act(async () => {
        await result.current.loadEntries(); // Should skip
      });

      expect(mockElectronAPI.getKBEntries).not.toHaveBeenCalled();
      expect(Array.from(result.current.entries.values())).toEqual(entriesBefore);
    });
  });

  describe('Create Entry', () => {
    it('should create entry with optimistic update', async () => {
      const createdEntry = { ...mockEntryInput, id: 'new-1', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z', usage_count: 0, success_count: 0, failure_count: 0 };
      mockElectronAPI.addKBEntry.mockResolvedValue(createdEntry);

      const { result } = renderHook(() => useReactiveStore());

      let createdResult: KBEntry;
      await act(async () => {
        createdResult = await result.current.createEntry(mockEntryInput, true);
      });

      expect(createdResult!).toEqual(createdEntry);
      expect(result.current.entries.get('new-1')).toEqual(createdEntry);
      expect(result.current.metrics.successfulOperations).toBe(1);
      expect(result.current.metrics.totalOperations).toBe(1);
      expect(mockElectronAPI.addKBEntry).toHaveBeenCalledWith(mockEntryInput);
    });

    it('should handle optimistic update rollback on failure', async () => {
      const error = new Error('Create failed');
      mockElectronAPI.addKBEntry.mockRejectedValue(error);

      const { result } = renderHook(() => useReactiveStore());

      await act(async () => {
        try {
          await result.current.createEntry(mockEntryInput, true);
        } catch (e) {
          expect(e).toBe(error);
        }
      });

      expect(result.current.metrics.failedOperations).toBe(1);
      expect(result.current.errors.size).toBe(1);
      expect(result.current.optimisticOperations.size).toBe(1);
    });

    it('should create entry without optimistic update', async () => {
      const createdEntry = { ...mockEntryInput, id: 'new-1', created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z', usage_count: 0, success_count: 0, failure_count: 0 };
      mockElectronAPI.addKBEntry.mockResolvedValue(createdEntry);

      const { result } = renderHook(() => useReactiveStore());

      let createdResult: KBEntry;
      await act(async () => {
        createdResult = await result.current.createEntry(mockEntryInput, false);
      });

      expect(createdResult!).toEqual(createdEntry);
      expect(result.current.entries.get('new-1')).toEqual(createdEntry);
      expect(result.current.optimisticOperations.size).toBe(0);
    });
  });

  describe('Update Entry', () => {
    beforeEach(() => {
      act(() => {
        useReactiveStore.setState({
          entries: new Map([['test-1', mockEntry]]),
        });
      });
    });

    it('should update entry with optimistic update', async () => {
      const updatedEntry = { ...mockEntry, ...mockEntryUpdate, updated_at: '2025-01-02T00:00:00.000Z' };
      mockElectronAPI.updateKBEntry.mockResolvedValue(updatedEntry);

      const { result } = renderHook(() => useReactiveStore());

      let updateResult: KBEntry;
      await act(async () => {
        updateResult = await result.current.updateEntry('test-1', mockEntryUpdate, true);
      });

      expect(updateResult!).toEqual(updatedEntry);
      expect(result.current.entries.get('test-1')).toEqual(updatedEntry);
      expect(result.current.metrics.successfulOperations).toBe(1);
      expect(mockElectronAPI.updateKBEntry).toHaveBeenCalledWith('test-1', mockEntryUpdate);
    });

    it('should rollback optimistic update on failure', async () => {
      const error = new Error('Update failed');
      mockElectronAPI.updateKBEntry.mockRejectedValue(error);

      const { result } = renderHook(() => useReactiveStore());
      const originalEntry = result.current.entries.get('test-1');

      await act(async () => {
        try {
          await result.current.updateEntry('test-1', mockEntryUpdate, true);
        } catch (e) {
          expect(e).toBe(error);
        }
      });

      // Should rollback to original entry
      expect(result.current.entries.get('test-1')).toEqual(originalEntry);
      expect(result.current.metrics.failedOperations).toBe(1);
      expect(result.current.errors.size).toBe(1);
    });

    it('should throw error for non-existent entry', async () => {
      const { result } = renderHook(() => useReactiveStore());

      await act(async () => {
        try {
          await result.current.updateEntry('non-existent', mockEntryUpdate, true);
          fail('Should have thrown error');
        } catch (error) {
          expect(error.message).toContain('not found');
        }
      });
    });
  });

  describe('Delete Entry', () => {
    beforeEach(() => {
      act(() => {
        useReactiveStore.setState({
          entries: new Map([['test-1', mockEntry]]),
        });
      });
    });

    it('should delete entry with optimistic update', async () => {
      mockElectronAPI.deleteKBEntry.mockResolvedValue(undefined);

      const { result } = renderHook(() => useReactiveStore());

      await act(async () => {
        await result.current.deleteEntry('test-1', true);
      });

      expect(result.current.entries.has('test-1')).toBe(false);
      expect(result.current.metrics.successfulOperations).toBe(1);
      expect(mockElectronAPI.deleteKBEntry).toHaveBeenCalledWith('test-1');
    });

    it('should rollback optimistic delete on failure', async () => {
      const error = new Error('Delete failed');
      mockElectronAPI.deleteKBEntry.mockRejectedValue(error);

      const { result } = renderHook(() => useReactiveStore());

      await act(async () => {
        try {
          await result.current.deleteEntry('test-1', true);
        } catch (e) {
          expect(e).toBe(error);
        }
      });

      // Should restore the deleted entry
      expect(result.current.entries.get('test-1')).toEqual(mockEntry);
      expect(result.current.metrics.failedOperations).toBe(1);
      expect(result.current.errors.size).toBe(1);
    });
  });

  describe('Batch Operations', () => {
    it('should create multiple entries in batches', async () => {
      const entries = [mockEntryInput, { ...mockEntryInput, title: 'Entry 2' }];
      const createdEntries = entries.map((entry, index) => ({
        ...entry,
        id: `batch-${index}`,
        created_at: '2025-01-01T00:00:00.000Z',
        updated_at: '2025-01-01T00:00:00.000Z',
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
      }));

      mockElectronAPI.addKBEntry.mockImplementation((entry) => {
        const index = entries.findIndex(e => e.title === entry.title);
        return Promise.resolve(createdEntries[index]);
      });

      const { result } = renderHook(() => useReactiveStore());

      let results: KBEntry[];
      await act(async () => {
        results = await result.current.createEntries(entries, true);
      });

      expect(results!).toEqual(createdEntries);
      expect(result.current.entries.size).toBe(2);
      expect(result.current.metrics.successfulOperations).toBe(2);
    });

    it('should update multiple entries in batches', async () => {
      const initialEntries = new Map([
        ['test-1', mockEntry],
        ['test-2', { ...mockEntry, id: 'test-2', title: 'Entry 2' }],
      ]);

      act(() => {
        useReactiveStore.setState({ entries: initialEntries });
      });

      const updates = [
        { id: 'test-1', updates: { title: 'Updated 1' } },
        { id: 'test-2', updates: { title: 'Updated 2' } },
      ];

      const updatedEntries = updates.map(({ id, updates: entryUpdates }) => ({
        ...initialEntries.get(id)!,
        ...entryUpdates,
        updated_at: '2025-01-02T00:00:00.000Z',
      }));

      mockElectronAPI.updateKBEntry.mockImplementation((id, entryUpdates) => {
        const original = initialEntries.get(id);
        return Promise.resolve({ ...original, ...entryUpdates, updated_at: '2025-01-02T00:00:00.000Z' });
      });

      const { result } = renderHook(() => useReactiveStore());

      let results: KBEntry[];
      await act(async () => {
        results = await result.current.updateEntries(updates, true);
      });

      expect(results!).toHaveLength(2);
      expect(result.current.entries.get('test-1')?.title).toBe('Updated 1');
      expect(result.current.entries.get('test-2')?.title).toBe('Updated 2');
    });

    it('should delete multiple entries in batches', async () => {
      const initialEntries = new Map([
        ['test-1', mockEntry],
        ['test-2', { ...mockEntry, id: 'test-2' }],
      ]);

      act(() => {
        useReactiveStore.setState({ entries: initialEntries });
      });

      mockElectronAPI.deleteKBEntry.mockResolvedValue(undefined);

      const { result } = renderHook(() => useReactiveStore());

      await act(async () => {
        await result.current.deleteEntries(['test-1', 'test-2'], true);
      });

      expect(result.current.entries.size).toBe(0);
      expect(result.current.metrics.successfulOperations).toBe(2);
    });
  });

  describe('Optimistic Operations Management', () => {
    it('should rollback optimistic operation', async () => {
      // Setup optimistic operation
      act(() => {
        useReactiveStore.setState({
          entries: new Map([['test-1', { ...mockEntry, title: 'Updated Title' }]]),
          optimisticOperations: new Map([
            ['op-1', {
              id: 'op-1',
              type: 'update',
              timestamp: Date.now(),
              retryCount: 0,
              maxRetries: 3,
              optimistic: true,
            }],
          ]),
          rollbackData: new Map([['op-1', mockEntry]]),
        });
      });

      const { result } = renderHook(() => useReactiveStore());

      act(() => {
        result.current.rollbackOptimisticOperation('op-1');
      });

      expect(result.current.entries.get('test-1')).toEqual(mockEntry);
      expect(result.current.optimisticOperations.has('op-1')).toBe(false);
      expect(result.current.rollbackData.has('op-1')).toBe(false);
    });

    it('should clear all optimistic operations', async () => {
      act(() => {
        useReactiveStore.setState({
          entries: new Map([['test-1', { ...mockEntry, title: 'Updated Title' }]]),
          optimisticOperations: new Map([
            ['op-1', {
              id: 'op-1',
              type: 'update',
              timestamp: Date.now(),
              retryCount: 0,
              maxRetries: 3,
              optimistic: true,
            }],
          ]),
          rollbackData: new Map([['op-1', mockEntry]]),
        });
      });

      const { result } = renderHook(() => useReactiveStore());

      act(() => {
        result.current.clearOptimisticOperations();
      });

      expect(result.current.optimisticOperations.size).toBe(0);
      expect(result.current.rollbackData.size).toBe(0);
    });
  });

  describe('Filter and Pagination', () => {
    it('should update filters', () => {
      const { result } = renderHook(() => useReactiveStore());

      act(() => {
        result.current.updateFilters({ category: 'JCL', search: 'test query' });
      });

      expect(result.current.filters.category).toBe('JCL');
      expect(result.current.filters.search).toBe('test query');
      expect(result.current.pagination.currentPage).toBe(1); // Should reset to page 1
    });

    it('should update pagination', () => {
      const { result } = renderHook(() => useReactiveStore());

      act(() => {
        result.current.updatePagination({ currentPage: 3, pageSize: 25 });
      });

      expect(result.current.pagination.currentPage).toBe(3);
      expect(result.current.pagination.pageSize).toBe(25);
    });

    it('should reset filters', () => {
      const { result } = renderHook(() => useReactiveStore());

      // Set some filters first
      act(() => {
        result.current.updateFilters({ category: 'JCL', search: 'test' });
        result.current.updatePagination({ currentPage: 3 });
      });

      // Reset filters
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters).toEqual({});
      expect(result.current.pagination.currentPage).toBe(1);
    });
  });

  describe('Error Management', () => {
    it('should clear specific error', () => {
      const { result } = renderHook(() => useReactiveStore());

      act(() => {
        useReactiveStore.setState({
          errors: new Map([
            ['error-1', { code: 'TEST_ERROR', message: 'Test error', timestamp: Date.now() }],
            ['error-2', { code: 'TEST_ERROR_2', message: 'Test error 2', timestamp: Date.now() }],
          ]),
        });
      });

      act(() => {
        result.current.clearError('error-1');
      });

      expect(result.current.errors.has('error-1')).toBe(false);
      expect(result.current.errors.has('error-2')).toBe(true);
    });

    it('should clear all errors', () => {
      const { result } = renderHook(() => useReactiveStore());

      act(() => {
        useReactiveStore.setState({
          errors: new Map([
            ['error-1', { code: 'TEST_ERROR', message: 'Test error', timestamp: Date.now() }],
            ['error-2', { code: 'TEST_ERROR_2', message: 'Test error 2', timestamp: Date.now() }],
          ]),
        });
      });

      act(() => {
        result.current.clearAllErrors();
      });

      expect(result.current.errors.size).toBe(0);
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      act(() => {
        useReactiveStore.setState({
          entries: new Map([
            ['test-1', { ...mockEntry, category: 'JCL' }],
            ['test-2', { ...mockEntry, id: 'test-2', category: 'VSAM' }],
            ['test-3', { ...mockEntry, id: 'test-3', category: 'JCL', tags: ['special'] }],
          ]),
        });
      });
    });

    it('should get entry by id', () => {
      const { result } = renderHook(() => useReactiveStore());

      const entry = result.current.getEntry('test-1');
      expect(entry?.id).toBe('test-1');

      const nonExistent = result.current.getEntry('non-existent');
      expect(nonExistent).toBe(null);
    });

    it('should get entries by category', () => {
      const { result } = renderHook(() => useReactiveStore());

      const jclEntries = result.current.getEntriesByCategory('JCL');
      expect(jclEntries).toHaveLength(2);
      expect(jclEntries.every(e => e.category === 'JCL')).toBe(true);
    });

    it('should invalidate cache', () => {
      const { result } = renderHook(() => useReactiveStore());

      // Set a recent timestamp
      act(() => {
        useReactiveStore.setState({ lastSyncTimestamp: Date.now() });
      });

      expect(result.current.lastSyncTimestamp).toBeGreaterThan(0);

      act(() => {
        result.current.invalidateCache();
      });

      expect(result.current.lastSyncTimestamp).toBe(0);
    });
  });

  describe('Offline Mode', () => {
    it('should set offline mode', () => {
      const { result } = renderHook(() => useReactiveStore());

      act(() => {
        result.current.setOfflineMode(true);
      });

      expect(result.current.isOffline).toBe(true);
    });

    it('should trigger sync when coming back online', (done) => {
      const { result } = renderHook(() => useReactiveStore());

      // Mock syncWithServer
      const originalSync = result.current.syncWithServer;
      const mockSync = jest.fn().mockResolvedValue(undefined);
      useReactiveStore.setState({ syncWithServer: mockSync } as any);

      // Add items to sync queue
      act(() => {
        useReactiveStore.setState({
          syncQueue: [{
            operation: {
              id: 'op-1',
              type: 'create',
              timestamp: Date.now(),
              retryCount: 0,
              maxRetries: 3,
              optimistic: true,
            },
            data: mockEntryInput,
            resolve: () => {},
            reject: () => {},
          }],
        });
      });

      act(() => {
        result.current.setOfflineMode(false);
      });

      expect(result.current.isOffline).toBe(false);

      // Verify sync is triggered after timeout
      setTimeout(() => {
        expect(mockSync).toHaveBeenCalled();
        done();
      }, 1100);
    });
  });
});