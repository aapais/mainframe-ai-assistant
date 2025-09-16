/**
 * Unit Tests for KBDataContext
 * 
 * Tests for the Knowledge Base Data Context provider including:
 * - Context provider initialization and state management
 * - CRUD operations (Create, Read, Update, Delete)
 * - Batch operations and performance optimizations
 * - Caching mechanisms and cache invalidation
 * - Error handling and retry logic
 * - Filter and pagination functionality
 * - Usage tracking and metrics
 * - Offline functionality and data persistence
 * 
 * @author Test Engineer
 * @version 1.0.0
 */

import React from 'react';
import { render, renderHook, act, waitFor, screen } from '@testing-library/react';
import { KBDataProvider, useKBData, KBDataState, LoadEntriesOptions } from '../KBDataContext';
import { KBEntry, KBEntryInput, KBEntryUpdate, KBCategory } from '../../../types/services';

// Mock electron API
const mockElectronAPI = {
  getKBEntries: jest.fn(),
  getKBEntry: jest.fn(),
  addKBEntry: jest.fn(),
  updateKBEntry: jest.fn(),
  deleteKBEntry: jest.fn(),
  rateKBEntry: jest.fn(),
  recordEntryView: jest.fn(),
};

// @ts-ignore
global.window.electronAPI = mockElectronAPI;

// Test utilities
const mockKBEntry: KBEntry = {
  id: 'test-entry-1',
  title: 'Test Entry',
  problem: 'Test problem description',
  solution: 'Test solution steps',
  category: 'VSAM',
  tags: ['test', 'vsam'],
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  usage_count: 5,
  success_count: 4,
  failure_count: 1,
};

const mockKBEntry2: KBEntry = {
  id: 'test-entry-2',
  title: 'Another Test Entry',
  problem: 'Another problem',
  solution: 'Another solution',
  category: 'JCL',
  tags: ['test', 'jcl'],
  created_at: new Date('2024-01-02'),
  updated_at: new Date('2024-01-02'),
  usage_count: 3,
  success_count: 2,
  failure_count: 1,
};

const createTestWrapper = (initialState?: Partial<KBDataState>) => {
  return ({ children }: { children: React.ReactNode }) => (
    <KBDataProvider initialState={initialState}>
      {children}
    </KBDataProvider>
  );
};

describe('KBDataContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Provider Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      expect(result.current.state.entries.size).toBe(0);
      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.error).toBe(null);
      expect(result.current.state.totalEntries).toBe(0);
      expect(result.current.state.categories).toEqual([
        'JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other'
      ]);
    });

    it('should initialize with custom initial state', () => {
      const initialState = {
        totalEntries: 10,
        pagination: { currentPage: 2, pageSize: 25, hasMore: true },
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      expect(result.current.state.totalEntries).toBe(10);
      expect(result.current.state.pagination.currentPage).toBe(2);
      expect(result.current.state.pagination.pageSize).toBe(25);
    });

    it('should throw error when used outside provider', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      expect(() => {
        renderHook(() => useKBData());
      }).toThrow('useKBData must be used within a KBDataProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Loading Entries', () => {
    it('should load entries successfully', async () => {
      mockElectronAPI.getKBEntries.mockResolvedValue({
        entries: [mockKBEntry, mockKBEntry2],
        total: 2,
      });

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.loadEntries();
      });

      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.entries.size).toBe(2);
      expect(result.current.state.totalEntries).toBe(2);
      expect(result.current.state.error).toBe(null);
      expect(result.current.state.cacheStatus).toBe('fresh');
    });

    it('should handle array response format', async () => {
      mockElectronAPI.getKBEntries.mockResolvedValue([mockKBEntry]);

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.loadEntries();
      });

      expect(result.current.state.entries.size).toBe(1);
      expect(result.current.state.totalEntries).toBe(1);
    });

    it('should handle loading errors', async () => {
      const error = new Error('Failed to load entries');
      mockElectronAPI.getKBEntries.mockRejectedValue(error);

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.loadEntries();
      });

      expect(result.current.state.isLoading).toBe(false);
      expect(result.current.state.error).toBe('Failed to load entries');
      expect(result.current.state.entries.size).toBe(0);
    });

    it('should respect cache when loading entries', async () => {
      mockElectronAPI.getKBEntries.mockResolvedValue({
        entries: [mockKBEntry],
        total: 1,
      });

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      // First load
      await act(async () => {
        await result.current.loadEntries();
      });

      expect(mockElectronAPI.getKBEntries).toHaveBeenCalledTimes(1);

      // Second load should use cache
      await act(async () => {
        await result.current.loadEntries();
      });

      expect(mockElectronAPI.getKBEntries).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it('should force reload when requested', async () => {
      mockElectronAPI.getKBEntries.mockResolvedValue({
        entries: [mockKBEntry],
        total: 1,
      });

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      // First load
      await act(async () => {
        await result.current.loadEntries();
      });

      // Force reload
      await act(async () => {
        await result.current.refreshEntries();
      });

      expect(mockElectronAPI.getKBEntries).toHaveBeenCalledTimes(2);
    });
  });

  describe('CRUD Operations', () => {
    describe('Create Entry', () => {
      it('should create entry successfully', async () => {
        const newEntry: KBEntryInput = {
          title: 'New Entry',
          problem: 'New problem',
          solution: 'New solution',
          category: 'DB2',
          tags: ['new', 'db2'],
        };

        const createdEntry: KBEntry = {
          ...newEntry,
          id: 'new-entry-1',
          created_at: new Date(),
          updated_at: new Date(),
          usage_count: 0,
          success_count: 0,
          failure_count: 0,
        };

        mockElectronAPI.addKBEntry.mockResolvedValue(createdEntry);

        const { result } = renderHook(() => useKBData(), {
          wrapper: createTestWrapper(),
        });

        let resultEntry: KBEntry;
        await act(async () => {
          resultEntry = await result.current.createEntry(newEntry);
        });

        expect(result.current.state.isSaving).toBe(false);
        expect(result.current.state.entries.has('new-entry-1')).toBe(true);
        expect(result.current.state.totalEntries).toBe(1);
        expect(result.current.state.operationError).toBe(null);
        expect(resultEntry!).toEqual(createdEntry);
      });

      it('should handle create entry errors', async () => {
        const newEntry: KBEntryInput = {
          title: 'New Entry',
          problem: 'New problem',
          solution: 'New solution',
          category: 'DB2',
          tags: ['new', 'db2'],
        };

        const error = new Error('Failed to create entry');
        mockElectronAPI.addKBEntry.mockRejectedValue(error);

        const { result } = renderHook(() => useKBData(), {
          wrapper: createTestWrapper(),
        });

        await expect(async () => {
          await act(async () => {
            await result.current.createEntry(newEntry);
          });
        }).rejects.toThrow('Failed to create entry');

        expect(result.current.state.isSaving).toBe(false);
        expect(result.current.state.operationError?.operation).toBe('create');
        expect(result.current.state.entries.size).toBe(0);
      });
    });

    describe('Update Entry', () => {
      it('should update entry successfully', async () => {
        const updates: KBEntryUpdate = {
          title: 'Updated Title',
          tags: ['updated', 'test'],
        };

        const updatedEntry: KBEntry = {
          ...mockKBEntry,
          ...updates,
          updated_at: new Date(),
        };

        mockElectronAPI.updateKBEntry.mockResolvedValue(updatedEntry);

        // Pre-populate with existing entry
        const initialState = {
          entries: new Map([['test-entry-1', mockKBEntry]]),
          totalEntries: 1,
        };

        const { result } = renderHook(() => useKBData(), {
          wrapper: createTestWrapper(initialState),
        });

        let resultEntry: KBEntry;
        await act(async () => {
          resultEntry = await result.current.updateEntry('test-entry-1', updates);
        });

        expect(result.current.state.isSaving).toBe(false);
        expect(result.current.state.entries.get('test-entry-1')?.title).toBe('Updated Title');
        expect(result.current.state.operationError).toBe(null);
        expect(resultEntry!).toEqual(updatedEntry);
      });

      it('should handle update entry errors', async () => {
        const updates: KBEntryUpdate = { title: 'Updated Title' };
        const error = new Error('Failed to update entry');
        mockElectronAPI.updateKBEntry.mockRejectedValue(error);

        const { result } = renderHook(() => useKBData(), {
          wrapper: createTestWrapper(),
        });

        await expect(async () => {
          await act(async () => {
            await result.current.updateEntry('test-entry-1', updates);
          });
        }).rejects.toThrow('Failed to update entry');

        expect(result.current.state.isSaving).toBe(false);
        expect(result.current.state.operationError?.operation).toBe('update');
      });
    });

    describe('Delete Entry', () => {
      it('should delete entry successfully', async () => {
        mockElectronAPI.deleteKBEntry.mockResolvedValue(undefined);

        // Pre-populate with existing entry
        const initialState = {
          entries: new Map([['test-entry-1', mockKBEntry]]),
          totalEntries: 1,
        };

        const { result } = renderHook(() => useKBData(), {
          wrapper: createTestWrapper(initialState),
        });

        await act(async () => {
          await result.current.deleteEntry('test-entry-1');
        });

        expect(result.current.state.isDeleting).toBe(false);
        expect(result.current.state.entries.has('test-entry-1')).toBe(false);
        expect(result.current.state.totalEntries).toBe(0);
        expect(result.current.state.operationError).toBe(null);
      });

      it('should handle delete entry errors', async () => {
        const error = new Error('Failed to delete entry');
        mockElectronAPI.deleteKBEntry.mockRejectedValue(error);

        const { result } = renderHook(() => useKBData(), {
          wrapper: createTestWrapper(),
        });

        await expect(async () => {
          await act(async () => {
            await result.current.deleteEntry('test-entry-1');
          });
        }).rejects.toThrow('Failed to delete entry');

        expect(result.current.state.isDeleting).toBe(false);
        expect(result.current.state.operationError?.operation).toBe('delete');
      });
    });
  });

  describe('Batch Operations', () => {
    it('should create multiple entries in batches', async () => {
      const entries: KBEntryInput[] = [
        { title: 'Entry 1', problem: 'Problem 1', solution: 'Solution 1', category: 'JCL', tags: [] },
        { title: 'Entry 2', problem: 'Problem 2', solution: 'Solution 2', category: 'VSAM', tags: [] },
      ];

      const createdEntries: KBEntry[] = entries.map((entry, index) => ({
        ...entry,
        id: `entry-${index + 1}`,
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: 0,
        success_count: 0,
        failure_count: 0,
      }));

      mockElectronAPI.addKBEntry.mockImplementation((entry) => {
        const index = entries.indexOf(entry);
        return Promise.resolve(createdEntries[index]);
      });

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      let resultEntries: KBEntry[];
      await act(async () => {
        resultEntries = await result.current.createEntries(entries);
      });

      expect(result.current.state.isSaving).toBe(false);
      expect(result.current.state.entries.size).toBe(2);
      expect(result.current.state.totalEntries).toBe(2);
      expect(resultEntries!).toEqual(createdEntries);
    });

    it('should update multiple entries in batches', async () => {
      const updates = [
        { id: 'test-entry-1', updates: { title: 'Updated Entry 1' } },
        { id: 'test-entry-2', updates: { title: 'Updated Entry 2' } },
      ];

      const updatedEntries: KBEntry[] = [
        { ...mockKBEntry, title: 'Updated Entry 1', updated_at: new Date() },
        { ...mockKBEntry2, title: 'Updated Entry 2', updated_at: new Date() },
      ];

      mockElectronAPI.updateKBEntry.mockImplementation((id, update) => {
        const index = updates.findIndex(u => u.id === id);
        return Promise.resolve(updatedEntries[index]);
      });

      const initialState = {
        entries: new Map([
          ['test-entry-1', mockKBEntry],
          ['test-entry-2', mockKBEntry2],
        ]),
        totalEntries: 2,
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      let resultEntries: KBEntry[];
      await act(async () => {
        resultEntries = await result.current.updateEntries(updates);
      });

      expect(result.current.state.isSaving).toBe(false);
      expect(result.current.state.entries.get('test-entry-1')?.title).toBe('Updated Entry 1');
      expect(result.current.state.entries.get('test-entry-2')?.title).toBe('Updated Entry 2');
      expect(resultEntries!).toEqual(updatedEntries);
    });

    it('should delete multiple entries in batches', async () => {
      const idsToDelete = ['test-entry-1', 'test-entry-2'];
      mockElectronAPI.deleteKBEntry.mockResolvedValue(undefined);

      const initialState = {
        entries: new Map([
          ['test-entry-1', mockKBEntry],
          ['test-entry-2', mockKBEntry2],
        ]),
        totalEntries: 2,
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      await act(async () => {
        await result.current.deleteEntries(idsToDelete);
      });

      expect(result.current.state.isDeleting).toBe(false);
      expect(result.current.state.entries.size).toBe(0);
      expect(result.current.state.totalEntries).toBe(0);
    });
  });

  describe('Entry Retrieval', () => {
    const initialState = {
      entries: new Map([
        ['test-entry-1', mockKBEntry],
        ['test-entry-2', mockKBEntry2],
      ]),
      totalEntries: 2,
    };

    it('should get single entry by ID', () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      const entry = result.current.getEntry('test-entry-1');
      expect(entry).toEqual(mockKBEntry);
    });

    it('should return null for non-existent entry', () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      const entry = result.current.getEntry('non-existent');
      expect(entry).toBeNull();
    });

    it('should get multiple entries by IDs', () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      const entries = result.current.getEntries(['test-entry-1', 'test-entry-2']);
      expect(entries).toEqual([mockKBEntry, mockKBEntry2]);
    });

    it('should get entries by category', () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      const vsamEntries = result.current.getEntriesByCategory('VSAM');
      expect(vsamEntries).toEqual([mockKBEntry]);

      const jclEntries = result.current.getEntriesByCategory('JCL');
      expect(jclEntries).toEqual([mockKBEntry2]);
    });

    it('should get entries by tags', () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      const testEntries = result.current.getEntriesByTags(['test']);
      expect(testEntries).toEqual([mockKBEntry, mockKBEntry2]);

      const vsamEntries = result.current.getEntriesByTags(['vsam']);
      expect(vsamEntries).toEqual([mockKBEntry]);
    });
  });

  describe('Usage Tracking', () => {
    it('should record entry usage successfully', async () => {
      mockElectronAPI.rateKBEntry.mockResolvedValue(undefined);

      const initialState = {
        entries: new Map([['test-entry-1', mockKBEntry]]),
        totalEntries: 1,
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      await act(async () => {
        await result.current.recordEntryUsage('test-entry-1', true, { comment: 'Helpful!' });
      });

      expect(mockElectronAPI.rateKBEntry).toHaveBeenCalledWith('test-entry-1', true, 'Helpful!');
    });

    it('should record entry view successfully', async () => {
      mockElectronAPI.recordEntryView.mockResolvedValue(undefined);

      const initialState = {
        entries: new Map([['test-entry-1', mockKBEntry]]),
        totalEntries: 1,
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      await act(async () => {
        await result.current.recordEntryView('test-entry-1');
      });

      expect(mockElectronAPI.recordEntryView).toHaveBeenCalledWith('test-entry-1');
    });

    it('should handle usage tracking errors gracefully', async () => {
      mockElectronAPI.rateKBEntry.mockRejectedValue(new Error('Rating failed'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const initialState = {
        entries: new Map([['test-entry-1', mockKBEntry]]),
        totalEntries: 1,
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      await act(async () => {
        await result.current.recordEntryUsage('test-entry-1', true);
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to record entry usage:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Filters and Pagination', () => {
    it('should update filters', () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.updateFilters({ category: 'VSAM', tags: ['test'] });
      });

      expect(result.current.state.currentFilters.category).toBe('VSAM');
      expect(result.current.state.currentFilters.tags).toEqual(['test']);
      expect(result.current.state.pagination.currentPage).toBe(1); // Should reset to page 1
    });

    it('should update pagination', () => {
      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      act(() => {
        result.current.updatePagination({ currentPage: 3, pageSize: 25 });
      });

      expect(result.current.state.pagination.currentPage).toBe(3);
      expect(result.current.state.pagination.pageSize).toBe(25);
    });

    it('should reset filters', () => {
      const initialState = {
        currentFilters: { category: 'VSAM' as KBCategory, tags: ['test'] },
        pagination: { currentPage: 3, pageSize: 50, hasMore: true },
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.state.currentFilters).toEqual({});
      expect(result.current.state.pagination.currentPage).toBe(1);
    });
  });

  describe('Cache Management', () => {
    it('should invalidate cache', () => {
      const initialState = {
        cacheStatus: 'fresh' as const,
        lastFetch: Date.now(),
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      act(() => {
        result.current.invalidateCache();
      });

      expect(result.current.state.cacheStatus).toBe('invalid');
      expect(result.current.state.lastFetch).toBe(0);
    });

    it('should preload entries', async () => {
      const entriesToPreload = [mockKBEntry, mockKBEntry2];
      mockElectronAPI.getKBEntry.mockImplementation((id) => {
        return Promise.resolve(entriesToPreload.find(e => e.id === id));
      });

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      await act(async () => {
        await result.current.preloadEntries(['test-entry-1', 'test-entry-2']);
      });

      expect(mockElectronAPI.getKBEntry).toHaveBeenCalledWith('test-entry-1');
      expect(mockElectronAPI.getKBEntry).toHaveBeenCalledWith('test-entry-2');
    });

    it('should not preload already cached entries', async () => {
      const initialState = {
        entries: new Map([['test-entry-1', mockKBEntry]]),
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      await act(async () => {
        await result.current.preloadEntries(['test-entry-1']);
      });

      expect(mockElectronAPI.getKBEntry).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should clear errors', () => {
      const initialState = {
        error: 'Some error',
        operationError: { operation: 'create', message: 'Create failed' },
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.state.error).toBe(null);
      expect(result.current.state.operationError).toBe(null);
    });

    it('should retry failed delete operation', async () => {
      mockElectronAPI.deleteKBEntry.mockResolvedValue(undefined);

      const initialState = {
        operationError: { operation: 'delete', message: 'Delete failed', entryId: 'test-entry-1' },
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      await act(async () => {
        await result.current.retryFailedOperation();
      });

      expect(mockElectronAPI.deleteKBEntry).toHaveBeenCalledWith('test-entry-1');
    });

    it('should handle retry failures gracefully', async () => {
      mockElectronAPI.deleteKBEntry.mockRejectedValue(new Error('Still failing'));
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const initialState = {
        operationError: { operation: 'delete', message: 'Delete failed', entryId: 'test-entry-1' },
      };

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(initialState),
      });

      await act(async () => {
        await result.current.retryFailedOperation();
      });

      expect(consoleSpy).toHaveBeenCalledWith('Retry operation failed:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `entry-${i}`,
        title: `Entry ${i}`,
        problem: `Problem ${i}`,
        solution: `Solution ${i}`,
        category: 'VSAM' as KBCategory,
        tags: [`tag${i}`],
        created_at: new Date(),
        updated_at: new Date(),
        usage_count: i,
        success_count: Math.floor(i * 0.8),
        failure_count: Math.floor(i * 0.2),
      }));

      mockElectronAPI.getKBEntries.mockResolvedValue({
        entries: largeDataset,
        total: 1000,
      });

      const { result } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      const startTime = performance.now();
      
      await act(async () => {
        await result.current.loadEntries();
      });

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      expect(result.current.state.entries.size).toBe(1000);
      expect(result.current.state.totalEntries).toBe(1000);
      expect(loadTime).toBeLessThan(100); // Should load in under 100ms
    });

    it('should cleanup cache on unmount', () => {
      const { result, unmount } = renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      // Load some data first
      act(() => {
        result.current.invalidateCache();
      });

      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Auto-loading', () => {
    it('should auto-load entries on mount', async () => {
      mockElectronAPI.getKBEntries.mockResolvedValue({
        entries: [mockKBEntry],
        total: 1,
      });

      renderHook(() => useKBData(), {
        wrapper: createTestWrapper(),
      });

      await waitFor(() => {
        expect(mockElectronAPI.getKBEntries).toHaveBeenCalled();
      });
    });
  });
});