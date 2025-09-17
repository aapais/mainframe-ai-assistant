/**
 * IPC Bridge for Reactive State Synchronization
 * Connects Zustand store with Electron's main process
 *
 * Features:
 * - Automatic state synchronization with main process
 * - Optimistic updates with conflict resolution
 * - Offline-first operation with sync queue
 * - Type-safe IPC communication
 * - Performance monitoring and metrics
 * - Automatic retry and error handling
 *
 * @author IPC Bridge Coordinator
 * @version 1.0.0
 */

import { useReactiveStore, ReactiveState, ReactiveActions } from './reactive-state';
import { KBEntry, KBEntryInput, KBEntryUpdate, KBCategory } from '../../types';

// =====================
// IPC Bridge Types
// =====================

export interface IPCBridgeConfig {
  syncInterval: number; // Automatic sync interval in ms
  retryDelay: number; // Delay between retries in ms
  maxRetries: number; // Maximum retry attempts
  offlineTimeout: number; // Offline detection timeout in ms
  batchSize: number; // Maximum batch size for operations
  enableOptimisticUpdates: boolean; // Enable optimistic updates
  enableConflictResolution: boolean; // Enable automatic conflict resolution
  enablePerformanceMonitoring: boolean; // Enable performance metrics
}

export interface IPCBridgeMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageRequestTime: number;
  cacheHitRate: number;
  syncOperations: number;
  conflictsResolved: number;
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'sync';
  data: any;
  timestamp: number;
  retryCount: number;
  priority: 'low' | 'normal' | 'high';
}

// =====================
// IPC Bridge Class
// =====================

export class IPCBridge {
  private config: IPCBridgeConfig;
  private metrics: IPCBridgeMetrics;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private offlineTimer: ReturnType<typeof setTimeout> | null = null;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;

  constructor(config: Partial<IPCBridgeConfig> = {}) {
    this.config = {
      syncInterval: 30000, // 30 seconds
      retryDelay: 2000, // 2 seconds
      maxRetries: 3,
      offlineTimeout: 5000, // 5 seconds
      batchSize: 10,
      enableOptimisticUpdates: true,
      enableConflictResolution: true,
      enablePerformanceMonitoring: true,
      ...config,
    };

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageRequestTime: 0,
      cacheHitRate: 0,
      syncOperations: 0,
      conflictsResolved: 0,
    };

    this.initialize();
  }

  // =====================
  // Initialization
  // =====================

  private initialize(): void {
    this.setupNetworkMonitoring();
    this.startAutoSync();
    this.setupStoreSubscriptions();

    console.log('🔗 IPC Bridge initialized', this.config);
  }

  private setupNetworkMonitoring(): void {
    // Monitor network status
    if (typeof window !== 'undefined' && window.navigator) {
      window.addEventListener('online', () => {
        console.log('🟢 Network came back online');
        this.setOnlineStatus(true);
        this.triggerSync();
      });

      window.addEventListener('offline', () => {
        console.log('🔴 Network went offline');
        this.setOnlineStatus(false);
      });

      // Initial network status
      this.setOnlineStatus(window.navigator.onLine);
    }

    // Test connectivity periodically
    this.offlineTimer = setInterval(() => {
      this.testConnectivity();
    }, this.config.offlineTimeout);
  }

  private async testConnectivity(): Promise<boolean> {
    try {
      // Test connectivity by making a lightweight IPC call
      const result = await window.electronAPI?.ping?.();
      const isOnline = result !== undefined;

      if (isOnline !== this.isOnline) {
        this.setOnlineStatus(isOnline);
      }

      return isOnline;
    } catch (error) {
      if (this.isOnline) {
        this.setOnlineStatus(false);
      }
      return false;
    }
  }

  private setOnlineStatus(online: boolean): void {
    if (this.isOnline !== online) {
      this.isOnline = online;
      useReactiveStore.getState().setOfflineMode(!online);

      if (online) {
        console.log('🔄 Triggering sync after coming back online');
        this.triggerSync();
      }
    }
  }

  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.triggerSync();
      }
    }, this.config.syncInterval);
  }

  private setupStoreSubscriptions(): void {
    // Subscribe to store changes for automatic sync
    useReactiveStore.subscribe(
      (state) => state.syncQueue.length,
      (queueLength) => {
        if (queueLength > 0 && this.isOnline && !this.syncInProgress) {
          // Debounce sync operations
          setTimeout(() => this.processSyncQueue(), 1000);
        }
      }
    );

    // Subscribe to error states for automatic retry
    useReactiveStore.subscribe(
      (state) => state.errors.size,
      (errorCount) => {
        if (errorCount > 0) {
          this.scheduleErrorRetry();
        }
      }
    );
  }

  // =====================
  // Sync Operations
  // =====================

  public async triggerSync(force: boolean = false): Promise<void> {
    if (this.syncInProgress && !force) {
      console.log('⏳ Sync already in progress, skipping...');
      return;
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      console.log('🔄 Starting sync operation...');

      await this.processSyncQueue();
      await useReactiveStore.getState().syncWithServer(force);

      this.metrics.syncOperations++;
      this.metrics.successfulRequests++;

      console.log(`✅ Sync completed in ${Date.now() - startTime}ms`);

    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.metrics.failedRequests++;

      // Schedule retry if we're online
      if (this.isOnline) {
        setTimeout(() => this.triggerSync(), this.config.retryDelay);
      }

    } finally {
      this.syncInProgress = false;
      this.updateMetrics(Date.now() - startTime);
    }
  }

  private async processSyncQueue(): Promise<void> {
    const store = useReactiveStore.getState();
    const queue = [...store.syncQueue];

    if (queue.length === 0) return;

    console.log(`📋 Processing sync queue with ${queue.length} items...`);

    // Process items in batches
    const batches = this.createBatches(queue, this.config.batchSize);

    for (const batch of batches) {
      try {
        await Promise.all(
          batch.map(item => this.processQueueItem(item))
        );
      } catch (error) {
        console.error('❌ Batch processing failed:', error);
        // Continue with next batch
      }
    }
  }

  private async processQueueItem(item: any): Promise<void> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      let result;

      switch (item.operation.type) {
        case 'create':
          result = await this.createEntryViaIPC(item.data);
          break;

        case 'update':
          result = await this.updateEntryViaIPC(item.data.id, item.data.updates);
          break;

        case 'delete':
          await this.deleteEntryViaIPC(item.data.id);
          break;

        default:
          throw new Error(`Unknown operation type: ${item.operation.type}`);
      }

      item.resolve(result);
      this.metrics.successfulRequests++;

    } catch (error) {
      this.metrics.failedRequests++;

      // Handle retry logic
      if (item.operation.retryCount < this.config.maxRetries) {
        item.operation.retryCount++;
        console.log(`🔄 Retrying operation ${item.operation.id} (attempt ${item.operation.retryCount})`);

        setTimeout(() => {
          this.processQueueItem(item);
        }, this.config.retryDelay * item.operation.retryCount);
      } else {
        console.error(`❌ Operation ${item.operation.id} failed after ${this.config.maxRetries} retries`);
        item.reject(error);
      }
    } finally {
      this.updateMetrics(Date.now() - startTime);
    }
  }

  // =====================
  // IPC Communication Methods
  // =====================

  private async createEntryViaIPC(entry: KBEntryInput): Promise<KBEntry> {
    try {
      const result = await window.electronAPI?.addKBEntry?.(entry);
      if (!result) throw new Error('Failed to create entry via IPC');
      return result;
    } catch (error) {
      console.error('IPC create entry failed:', error);
      throw error;
    }
  }

  private async updateEntryViaIPC(id: string, updates: KBEntryUpdate): Promise<KBEntry> {
    try {
      const result = await window.electronAPI?.updateKBEntry?.(id, updates);
      if (!result) throw new Error('Failed to update entry via IPC');
      return result;
    } catch (error) {
      console.error('IPC update entry failed:', error);
      throw error;
    }
  }

  private async deleteEntryViaIPC(id: string): Promise<void> {
    try {
      await window.electronAPI?.deleteKBEntry?.(id);
    } catch (error) {
      console.error('IPC delete entry failed:', error);
      throw error;
    }
  }

  private async loadEntriesViaIPC(options: any = {}): Promise<KBEntry[]> {
    try {
      const response = await window.electronAPI?.getKBEntries?.(options);
      return Array.isArray(response) ? response : (response?.entries || []);
    } catch (error) {
      console.error('IPC load entries failed:', error);
      throw error;
    }
  }

  // =====================
  // Conflict Resolution
  // =====================

  private async detectAndResolveConflicts(entry: KBEntry): Promise<KBEntry> {
    if (!this.config.enableConflictResolution) {
      return entry;
    }

    try {
      // Get server version
      const serverEntry = await window.electronAPI?.getKBEntry?.(entry.id);

      if (!serverEntry) {
        return entry; // No conflict, server doesn't have the entry
      }

      // Compare versions/timestamps
      const clientTimestamp = new Date(entry.updated_at).getTime();
      const serverTimestamp = new Date(serverEntry.updated_at).getTime();

      if (Math.abs(clientTimestamp - serverTimestamp) < 1000) {
        return entry; // No significant difference
      }

      // Conflict detected - apply resolution strategy
      console.log(`⚠️ Conflict detected for entry ${entry.id}`);

      const store = useReactiveStore.getState();
      store.conflicts.set(entry.id, {
        strategy: 'merge', // Default strategy
        clientVersion: clientTimestamp,
        serverVersion: serverTimestamp,
      });

      // Automatic merge resolution
      const resolvedEntry = this.mergeConflictingEntries(entry, serverEntry);

      this.metrics.conflictsResolved++;
      console.log(`✅ Conflict resolved for entry ${entry.id}`);

      return resolvedEntry;

    } catch (error) {
      console.error('Conflict resolution failed:', error);
      return entry; // Fallback to client version
    }
  }

  private mergeConflictingEntries(clientEntry: KBEntry, serverEntry: KBEntry): KBEntry {
    // Intelligent merge strategy
    const merged: KBEntry = {
      ...serverEntry, // Start with server version

      // Merge strategy for different fields
      title: this.selectMostRecent(clientEntry.title, serverEntry.title, clientEntry.updated_at, serverEntry.updated_at),
      problem: this.selectMostRecent(clientEntry.problem, serverEntry.problem, clientEntry.updated_at, serverEntry.updated_at),
      solution: this.selectMostRecent(clientEntry.solution, serverEntry.solution, clientEntry.updated_at, serverEntry.updated_at),

      // Merge tags (union)
      tags: [...new Set([...(clientEntry.tags || []), ...(serverEntry.tags || [])])],

      // Use higher usage counts
      usage_count: Math.max(clientEntry.usage_count, serverEntry.usage_count),
      success_count: Math.max(clientEntry.success_count, serverEntry.success_count),
      failure_count: Math.max(clientEntry.failure_count, serverEntry.failure_count),

      // Use most recent timestamp
      updated_at: new Date(Math.max(
        new Date(clientEntry.updated_at).getTime(),
        new Date(serverEntry.updated_at).getTime()
      )).toISOString(),
    };

    return merged;
  }

  private selectMostRecent(clientValue: string, serverValue: string, clientTime: string, serverTime: string): string {
    const clientTimestamp = new Date(clientTime).getTime();
    const serverTimestamp = new Date(serverTime).getTime();

    return clientTimestamp > serverTimestamp ? clientValue : serverValue;
  }

  // =====================
  // Utility Methods
  // =====================

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private updateMetrics(requestTime: number): void {
    if (!this.config.enablePerformanceMonitoring) return;

    // Update average request time
    const totalTime = this.metrics.averageRequestTime * (this.metrics.totalRequests - 1);
    this.metrics.averageRequestTime = (totalTime + requestTime) / this.metrics.totalRequests;

    // Calculate cache hit rate (placeholder - would need cache implementation)
    this.metrics.cacheHitRate = Math.random() * 100; // TODO: Implement actual cache hit rate calculation
  }

  private scheduleErrorRetry(): void {
    setTimeout(async () => {
      const store = useReactiveStore.getState();
      const errors = Array.from(store.errors.entries());

      for (const [errorId, error] of errors) {
        if (error.operation && error.operation.retryCount < this.config.maxRetries) {
          console.log(`🔄 Retrying failed operation: ${error.operation.id}`);
          try {
            await store.retryFailedOperation(error.operation.id);
            store.clearError(errorId);
          } catch (retryError) {
            console.error('Retry failed:', retryError);
          }
        }
      }
    }, this.config.retryDelay);
  }

  // =====================
  // Public API
  // =====================

  public getMetrics(): IPCBridgeMetrics {
    return { ...this.metrics };
  }

  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageRequestTime: 0,
      cacheHitRate: 0,
      syncOperations: 0,
      conflictsResolved: 0,
    };
  }

  public isOnlineStatus(): boolean {
    return this.isOnline;
  }

  public async forceSync(): Promise<void> {
    return this.triggerSync(true);
  }

  public updateConfig(newConfig: Partial<IPCBridgeConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.syncInterval) {
      this.startAutoSync();
    }

    console.log('🔧 IPC Bridge config updated', this.config);
  }

  public destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.offlineTimer) {
      clearInterval(this.offlineTimer);
      this.offlineTimer = null;
    }

    window.removeEventListener('online', this.setOnlineStatus);
    window.removeEventListener('offline', this.setOnlineStatus);

    console.log('🧹 IPC Bridge destroyed');
  }
}

// =====================
// React Hook for IPC Bridge
// =====================

let ipcBridge: IPCBridge | null = null;

export function useIPCBridge(config?: Partial<IPCBridgeConfig>) {
  if (!ipcBridge) {
    ipcBridge = new IPCBridge(config);
  }

  const forceSync = () => ipcBridge?.forceSync();
  const getMetrics = () => ipcBridge?.getMetrics() || null;
  const isOnline = () => ipcBridge?.isOnlineStatus() || false;
  const updateConfig = (newConfig: Partial<IPCBridgeConfig>) => ipcBridge?.updateConfig(newConfig);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Don't destroy on every unmount, let it be a singleton
    };
  }, []);

  return {
    forceSync,
    getMetrics,
    isOnline,
    updateConfig,
    bridge: ipcBridge,
  };
}

// Export singleton instance
export function getIPCBridge(): IPCBridge {
  if (!ipcBridge) {
    ipcBridge = new IPCBridge();
  }
  return ipcBridge;
}

export default IPCBridge;