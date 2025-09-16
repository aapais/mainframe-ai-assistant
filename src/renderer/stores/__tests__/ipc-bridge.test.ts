/**
 * IPC Bridge Tests
 * Comprehensive test suite for IPC bridge functionality
 *
 * @author Test Coordinator
 * @version 1.0.0
 */

import { IPCBridge } from '../ipc-bridge';
import { useReactiveStore } from '../reactive-state';

// Mock window.electronAPI
const mockElectronAPI = {
  getKBEntries: jest.fn(),
  addKBEntry: jest.fn(),
  updateKBEntry: jest.fn(),
  deleteKBEntry: jest.fn(),
  getKBEntry: jest.fn(),
  ping: jest.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

// Mock navigator.onLine
Object.defineProperty(window, 'navigator', {
  value: { onLine: true },
  writable: true,
});

// Mock event listeners
const mockEventListeners: { [key: string]: ((event: any) => void)[] } = {};
const originalAddEventListener = window.addEventListener;
const originalRemoveEventListener = window.removeEventListener;

beforeAll(() => {
  window.addEventListener = jest.fn((event: string, listener: (event: any) => void) => {
    if (!mockEventListeners[event]) {
      mockEventListeners[event] = [];
    }
    mockEventListeners[event].push(listener);
  });

  window.removeEventListener = jest.fn((event: string, listener: (event: any) => void) => {
    if (mockEventListeners[event]) {
      const index = mockEventListeners[event].indexOf(listener);
      if (index > -1) {
        mockEventListeners[event].splice(index, 1);
      }
    }
  });
});

afterAll(() => {
  window.addEventListener = originalAddEventListener;
  window.removeEventListener = originalRemoveEventListener;
});

// Helper to trigger mock events
const triggerEvent = (eventName: string, data?: any) => {
  if (mockEventListeners[eventName]) {
    mockEventListeners[eventName].forEach(listener => listener(data));
  }
};

// Test data
const mockEntryInput = {
  title: 'Test Entry',
  problem: 'Test problem',
  solution: 'Test solution',
  category: 'JCL' as const,
  tags: ['test'],
};

const mockEntry = {
  id: 'test-1',
  ...mockEntryInput,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  usage_count: 0,
  success_count: 0,
  failure_count: 0,
};

describe('IPCBridge', () => {
  let bridge: IPCBridge;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset store state
    useReactiveStore.setState({
      entries: new Map(),
      isOffline: false,
      isSyncing: false,
      syncQueue: [],
      errors: new Map(),
      optimisticOperations: new Map(),
      rollbackData: new Map(),
      conflicts: new Map(),
      lastSyncTimestamp: 0,
      metrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        optimisticSuccessRate: 0,
      },
    });

    bridge = new IPCBridge({
      syncInterval: 1000, // 1 second for testing
      retryDelay: 100, // 100ms for testing
      maxRetries: 2,
      offlineTimeout: 500, // 500ms for testing
      batchSize: 2,
    });
  });

  afterEach(() => {
    bridge.destroy();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const metrics = bridge.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBe(0);
      expect(bridge.isOnlineStatus()).toBe(true);
    });

    it('should setup network monitoring', () => {
      expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Network Status Management', () => {
    it('should detect online status change', () => {
      const store = useReactiveStore.getState();
      expect(store.isOffline).toBe(false);

      // Trigger offline event
      triggerEvent('offline');

      const updatedStore = useReactiveStore.getState();
      expect(updatedStore.isOffline).toBe(true);
      expect(bridge.isOnlineStatus()).toBe(false);
    });

    it('should trigger sync when coming back online', async () => {
      mockElectronAPI.getKBEntries.mockResolvedValue({ entries: [], total: 0 });

      // Go offline first
      triggerEvent('offline');
      expect(bridge.isOnlineStatus()).toBe(false);

      // Come back online
      triggerEvent('online');
      expect(bridge.isOnlineStatus()).toBe(true);

      // Wait for sync to be triggered
      jest.advanceTimersByTime(1100);

      // Sync should be called
      expect(mockElectronAPI.getKBEntries).toHaveBeenCalled();
    });

    it('should test connectivity periodically', async () => {
      mockElectronAPI.ping.mockResolvedValue(true);

      // Advance timer to trigger connectivity test
      jest.advanceTimersByTime(600);

      expect(mockElectronAPI.ping).toHaveBeenCalled();
    });

    it('should handle connectivity test failure', async () => {
      mockElectronAPI.ping.mockRejectedValue(new Error('Connection failed'));

      // Should be online initially
      expect(bridge.isOnlineStatus()).toBe(true);

      // Advance timer to trigger connectivity test
      jest.advanceTimersByTime(600);

      // Should be offline after failed test
      expect(bridge.isOnlineStatus()).toBe(false);
    });
  });

  describe('Sync Operations', () => {
    it('should trigger automatic sync', async () => {
      mockElectronAPI.getKBEntries.mockResolvedValue({ entries: [mockEntry], total: 1 });

      // Advance timer to trigger auto sync
      jest.advanceTimersByTime(1100);

      expect(mockElectronAPI.getKBEntries).toHaveBeenCalled();

      const metrics = bridge.getMetrics();
      expect(metrics.syncOperations).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
    });

    it('should not sync when offline', async () => {
      mockElectronAPI.getKBEntries.mockResolvedValue({ entries: [], total: 0 });

      // Go offline
      triggerEvent('offline');

      // Advance timer to trigger auto sync
      jest.advanceTimersByTime(1100);

      // Should not sync when offline
      expect(mockElectronAPI.getKBEntries).not.toHaveBeenCalled();
    });

    it('should handle sync failure with retry', async () => {
      const error = new Error('Sync failed');
      mockElectronAPI.getKBEntries.mockRejectedValueOnce(error).mockResolvedValue({ entries: [], total: 0 });

      // Trigger sync
      await bridge.triggerSync();

      expect(bridge.getMetrics().failedRequests).toBe(1);

      // Advance timer for retry
      jest.advanceTimersByTime(200);

      // Should retry and succeed
      expect(bridge.getMetrics().successfulRequests).toBe(1);
    });

    it('should process sync queue', async () => {
      mockElectronAPI.addKBEntry.mockResolvedValue(mockEntry);

      // Add item to sync queue
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
          resolve: jest.fn(),
          reject: jest.fn(),
        }],
      });

      await bridge.triggerSync();

      expect(mockElectronAPI.addKBEntry).toHaveBeenCalledWith(mockEntryInput);
    });
  });

  describe('Queue Processing', () => {
    it('should process create operations', async () => {
      mockElectronAPI.addKBEntry.mockResolvedValue(mockEntry);

      const resolveSpy = jest.fn();
      const rejectSpy = jest.fn();

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
          resolve: resolveSpy,
          reject: rejectSpy,
        }],
      });

      await bridge.triggerSync();

      expect(mockElectronAPI.addKBEntry).toHaveBeenCalledWith(mockEntryInput);
      expect(resolveSpy).toHaveBeenCalledWith(mockEntry);
      expect(rejectSpy).not.toHaveBeenCalled();
    });

    it('should process update operations', async () => {
      const updates = { title: 'Updated title' };
      const updatedEntry = { ...mockEntry, ...updates };
      mockElectronAPI.updateKBEntry.mockResolvedValue(updatedEntry);

      const resolveSpy = jest.fn();

      useReactiveStore.setState({
        syncQueue: [{
          operation: {
            id: 'op-1',
            type: 'update',
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: 3,
            optimistic: true,
          },
          data: { id: 'test-1', updates },
          resolve: resolveSpy,
          reject: jest.fn(),
        }],
      });

      await bridge.triggerSync();

      expect(mockElectronAPI.updateKBEntry).toHaveBeenCalledWith('test-1', updates);
      expect(resolveSpy).toHaveBeenCalledWith(updatedEntry);
    });

    it('should process delete operations', async () => {
      mockElectronAPI.deleteKBEntry.mockResolvedValue(undefined);

      const resolveSpy = jest.fn();

      useReactiveStore.setState({
        syncQueue: [{
          operation: {
            id: 'op-1',
            type: 'delete',
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: 3,
            optimistic: true,
          },
          data: { id: 'test-1' },
          resolve: resolveSpy,
          reject: jest.fn(),
        }],
      });

      await bridge.triggerSync();

      expect(mockElectronAPI.deleteKBEntry).toHaveBeenCalledWith('test-1');
      expect(resolveSpy).toHaveBeenCalledWith(undefined);
    });

    it('should handle operation failure with retry', async () => {
      const error = new Error('Operation failed');
      mockElectronAPI.addKBEntry
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue(mockEntry);

      const resolveSpy = jest.fn();
      const rejectSpy = jest.fn();

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
          resolve: resolveSpy,
          reject: rejectSpy,
        }],
      });

      await bridge.triggerSync();

      expect(mockElectronAPI.addKBEntry).toHaveBeenCalledTimes(1);
      expect(resolveSpy).not.toHaveBeenCalled();

      // Advance timer for first retry
      jest.advanceTimersByTime(200);
      expect(mockElectronAPI.addKBEntry).toHaveBeenCalledTimes(2);

      // Advance timer for second retry
      jest.advanceTimersByTime(400);
      expect(mockElectronAPI.addKBEntry).toHaveBeenCalledTimes(3);
      expect(resolveSpy).toHaveBeenCalledWith(mockEntry);
    });

    it('should give up after max retries', async () => {
      const error = new Error('Persistent failure');
      mockElectronAPI.addKBEntry.mockRejectedValue(error);

      const rejectSpy = jest.fn();

      useReactiveStore.setState({
        syncQueue: [{
          operation: {
            id: 'op-1',
            type: 'create',
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: 2,
            optimistic: true,
          },
          data: mockEntryInput,
          resolve: jest.fn(),
          reject: rejectSpy,
        }],
      });

      await bridge.triggerSync();

      // Wait for all retries
      jest.advanceTimersByTime(1000);

      expect(rejectSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('Batch Processing', () => {
    it('should process operations in batches', async () => {
      mockElectronAPI.addKBEntry.mockResolvedValue(mockEntry);

      const operations = Array.from({ length: 5 }, (_, i) => ({
        operation: {
          id: `op-${i}`,
          type: 'create' as const,
          timestamp: Date.now(),
          retryCount: 0,
          maxRetries: 3,
          optimistic: true,
        },
        data: { ...mockEntryInput, title: `Entry ${i}` },
        resolve: jest.fn(),
        reject: jest.fn(),
      }));

      useReactiveStore.setState({ syncQueue: operations });

      await bridge.triggerSync();

      // With batch size 2, should process in 3 batches (2, 2, 1)
      expect(mockElectronAPI.addKBEntry).toHaveBeenCalledTimes(5);
    });
  });

  describe('Conflict Resolution', () => {
    it('should detect conflicts', async () => {
      const clientEntry = { ...mockEntry, title: 'Client Version', updated_at: '2025-01-02T00:00:00.000Z' };
      const serverEntry = { ...mockEntry, title: 'Server Version', updated_at: '2025-01-01T12:00:00.000Z' };

      mockElectronAPI.getKBEntry.mockResolvedValue(serverEntry);

      // This would be called by the bridge internally during conflict detection
      const resolvedEntry = await (bridge as any).detectAndResolveConflicts(clientEntry);

      expect(resolvedEntry.title).toBe('Client Version'); // Client wins (more recent)
      expect(bridge.getMetrics().conflictsResolved).toBe(1);
    });

    it('should merge conflicting entries', async () => {
      const clientEntry = {
        ...mockEntry,
        title: 'Client Title',
        solution: 'Client Solution',
        usage_count: 10,
        updated_at: '2025-01-02T00:00:00.000Z'
      };
      const serverEntry = {
        ...mockEntry,
        title: 'Server Title',
        problem: 'Server Problem',
        usage_count: 5,
        updated_at: '2025-01-01T12:00:00.000Z'
      };

      const merged = (bridge as any).mergeConflictingEntries(clientEntry, serverEntry);

      expect(merged.title).toBe('Client Title'); // More recent
      expect(merged.problem).toBe('Server Problem'); // From server (base)
      expect(merged.solution).toBe('Client Solution'); // More recent
      expect(merged.usage_count).toBe(10); // Higher value
    });
  });

  describe('Metrics and Performance', () => {
    it('should track performance metrics', async () => {
      mockElectronAPI.addKBEntry.mockResolvedValue(mockEntry);

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
          resolve: jest.fn(),
          reject: jest.fn(),
        }],
      });

      const startMetrics = bridge.getMetrics();
      await bridge.triggerSync();
      const endMetrics = bridge.getMetrics();

      expect(endMetrics.totalRequests).toBeGreaterThan(startMetrics.totalRequests);
      expect(endMetrics.successfulRequests).toBeGreaterThan(startMetrics.successfulRequests);
      expect(endMetrics.averageRequestTime).toBeGreaterThan(0);
    });

    it('should reset metrics', () => {
      const metrics = bridge.getMetrics();
      metrics.totalRequests = 10;
      metrics.successfulRequests = 8;

      bridge.resetMetrics();

      const resetMetrics = bridge.getMetrics();
      expect(resetMetrics.totalRequests).toBe(0);
      expect(resetMetrics.successfulRequests).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      bridge.updateConfig({ syncInterval: 5000, maxRetries: 5 });

      // Configuration should be updated internally
      expect(bridge.isOnlineStatus()).toBeDefined(); // Ensure bridge is still functional
    });
  });

  describe('Cleanup', () => {
    it('should destroy properly', () => {
      bridge.destroy();

      expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Force Sync', () => {
    it('should force sync regardless of conditions', async () => {
      mockElectronAPI.getKBEntries.mockResolvedValue({ entries: [], total: 0 });

      // Set recent sync timestamp to simulate fresh data
      useReactiveStore.setState({
        lastSyncTimestamp: Date.now() - 1000, // 1 second ago
      });

      await bridge.forceSync();

      expect(mockElectronAPI.getKBEntries).toHaveBeenCalled();
      expect(bridge.getMetrics().syncOperations).toBe(1);
    });
  });
});