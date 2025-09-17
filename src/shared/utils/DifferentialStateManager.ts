/**
 * Differential State Manager
 *
 * Manages state versions and tracks changes to minimize data transfer.
 * Integrates with batching system to send only differential updates.
 */

import { DiffCalculator, Diff } from './DiffCalculator';
import { PatchApplicator, PatchOperation } from './PatchApplicator';
import { EventEmitter } from 'events';
import { setInterval, clearInterval, setTimeout } from 'timers';

export interface StateVersion<T = any> {
  version: number;
  timestamp: number;
  data: T;
  checksum: string;
  size: number;
}

export interface StateChange<T = any> {
  id: string;
  previousVersion: number;
  currentVersion: number;
  diff: Diff;
  patches: PatchOperation[];
  compressionRatio: number;
  metadata: {
    source: string;
    timestamp: number;
    dataType: string;
    estimatedSavings: number;
  };
}

export interface StateSubscription {
  id: string;
  stateKey: string;
  callback: (change: StateChange) => void;
  lastVersion: number;
  options: {
    immediate?: boolean | undefined;
    throttleMs?: number | undefined;
    maxDiffSize?: number | undefined;
    fallbackToFull?: boolean | undefined;
  };
}

interface StateTracker<T = any> {
  key: string;
  currentVersion: StateVersion<T>;
  previousVersions: Map<number, StateVersion<T>>;
  subscriptions: Set<StateSubscription>;
  lastUpdateTime: number;
  compressionEnabled: boolean;
  maxHistorySize: number;
}

export class DifferentialStateManager extends EventEmitter {
  private stateTrackers = new Map<string, StateTracker>();
  private diffCalculator = new DiffCalculator();
  private patchApplicator = new PatchApplicator();
  private subscriptions = new Map<string, StateSubscription>();
  private globalVersion = 0;
  private config: DifferentialConfig;

  constructor(config: Partial<DifferentialConfig> | undefined = {}) {
    super();
    this.config = {
      maxHistoryVersions: 10,
      compressionThreshold: 1024, // 1KB
      maxDiffSizeRatio: 0.7, // Don't diff if patch > 70% of original
      enableCompression: true,
      enableVersionCleanup: true,
      cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
      enableMetrics: true,
      ...(config || {})
    };

    if (this.config.enableVersionCleanup) {
      this.startVersionCleanup();
    }
  }

  /**
   * Initialize or update state and return differential change
   */
  async setState<T>(stateKey: string, data: T, options: SetStateOptions | undefined = {}): Promise<StateChange<T> | null> {
    const tracker = this.getOrCreateTracker(stateKey, options);
    const newVersion = ++this.globalVersion;
    const timestamp = Date.now();

    // Calculate checksum and size
    const serializedData = JSON.stringify(data);
    const checksum = this.calculateChecksum(serializedData);
    const size = serializedData.length;

    // Create new version
    const newStateVersion: StateVersion<T> = {
      version: newVersion,
      timestamp,
      data,
      checksum,
      size
    };

    // Check if data actually changed
    if (tracker.currentVersion && tracker.currentVersion.checksum === checksum) {
      return null; // No change
    }

    let stateChange: StateChange<T> | null = null;

    if (tracker.currentVersion) {
      // Calculate differential changes
      const diff = await this.diffCalculator.calculateDiff(
        tracker.currentVersion.data,
        data
      );

      const patches = await this.diffCalculator.generatePatches(diff);
      const compressionRatio = patches.length > 0 ?
        (size - this.estimatePatchSize(patches)) / size : 0;

      // Only create differential if it provides savings
      if (compressionRatio > 0.1 && patches.length / size < this.config.maxDiffSizeRatio) {
        stateChange = {
          id: this.generateChangeId(),
          previousVersion: tracker.currentVersion.version,
          currentVersion: newVersion,
          diff,
          patches,
          compressionRatio,
          metadata: {
            source: stateKey,
            timestamp,
            dataType: typeof data,
            estimatedSavings: Math.round((size * compressionRatio) / 1024) // KB saved
          }
        };
      }
    }

    // Store previous version if exists
    if (tracker.currentVersion) {
      tracker.previousVersions.set(tracker.currentVersion.version, tracker.currentVersion);

      // Limit history size
      if (tracker.previousVersions.size > this.config.maxHistoryVersions) {
        const oldestVersion = Math.min(...tracker.previousVersions.keys());
        tracker.previousVersions.delete(oldestVersion);
      }
    }

    // Update current version
    tracker.currentVersion = newStateVersion;
    tracker.lastUpdateTime = timestamp;

    // Notify subscriptions
    if (stateChange) {
      this.notifySubscriptions(stateKey, stateChange);
    }

    // Emit change event
    this.emit('stateChanged', {
      stateKey,
      change: stateChange,
      fullUpdate: !stateChange
    });

    return stateChange;
  }

  /**
   * Get current state version
   */
  getState<T>(stateKey: string): StateVersion<T> | null {
    const tracker = this.stateTrackers.get(stateKey);
    return tracker?.currentVersion || null;
  }

  /**
   * Get state at specific version
   */
  getStateVersion<T>(stateKey: string, version: number): StateVersion<T> | null {
    const tracker = this.stateTrackers.get(stateKey);
    if (!tracker) return null;

    if (tracker.currentVersion.version === version) {
      return tracker.currentVersion;
    }

    return tracker.previousVersions.get(version) || null;
  }

  /**
   * Apply differential update to get latest state
   */
  async applyDifferentialUpdate<T>(
    stateKey: string,
    baseVersion: number,
    stateChange: StateChange<T>
  ): Promise<T | null> {
    const tracker = this.stateTrackers.get(stateKey);
    if (!tracker) return null;

    const baseState = this.getStateVersion<T>(stateKey, baseVersion);
    if (!baseState) {
      // Base version not found, request full state
      return null;
    }

    try {
      const updatedData = await this.patchApplicator.applyPatches(
        baseState.data,
        stateChange.patches
      );

      // Verify the result matches the expected version
      const resultChecksum = this.calculateChecksum(JSON.stringify(updatedData));
      const expectedVersion = this.getStateVersion<T>(stateKey, stateChange.currentVersion);

      if (expectedVersion && expectedVersion.checksum === resultChecksum) {
        return updatedData;
      } else {
        console.warn(`Checksum mismatch for ${stateKey} after applying patches`);
        return null;
      }
    } catch (error) {
      console.error(`Failed to apply patches for ${stateKey}:`, error);
      return null;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe<T>(
    stateKey: string,
    callback: (change: StateChange<T>) => void,
    options: Partial<StateSubscription['options']> | undefined = {}
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    const tracker = this.getOrCreateTracker(stateKey);

    const subscription: StateSubscription = {
      id: subscriptionId,
      stateKey,
      callback: callback as any,
      lastVersion: tracker.currentVersion?.version || 0,
      options: {
        immediate: false,
        throttleMs: 0,
        maxDiffSize: 10 * 1024, // 10KB
        fallbackToFull: true,
        ...(options || {})
      }
    };

    this.subscriptions.set(subscriptionId, subscription);
    tracker.subscriptions.add(subscription);

    // Send immediate update if requested and state exists
    if (subscription.options.immediate === true && tracker.currentVersion) {
      // For immediate updates, we send the full state as a "change"
      const immediateChange: StateChange<T> = {
        id: this.generateChangeId(),
        previousVersion: 0,
        currentVersion: tracker.currentVersion.version,
        diff: { added: [], modified: [], deleted: [] },
        patches: [{
          op: 'replace',
          path: '',
          value: tracker.currentVersion.data
        }],
        compressionRatio: 0,
        metadata: {
          source: stateKey,
          timestamp: tracker.currentVersion.timestamp,
          dataType: typeof tracker.currentVersion.data,
          estimatedSavings: 0
        }
      };

      // Use setTimeout to make it async
      setTimeout(() => callback(immediateChange), 0);
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from state changes
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      const tracker = this.stateTrackers.get(subscription.stateKey);
      if (tracker) {
        tracker.subscriptions.delete(subscription);
      }
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Get differential changes since a version
   */
  async getDifferentialUpdate<T>(
    stateKey: string,
    sinceVersion: number
  ): Promise<StateChange<T> | null> {
    const tracker = this.stateTrackers.get(stateKey);
    if (!tracker || !tracker.currentVersion) return null;

    if (tracker.currentVersion.version === sinceVersion) {
      return null; // No changes
    }

    const previousVersion = this.getStateVersion<T>(stateKey, sinceVersion);
    if (!previousVersion) {
      // Previous version not available, client needs full update
      return null;
    }

    const diff = await this.diffCalculator.calculateDiff(
      previousVersion.data,
      tracker.currentVersion.data
    );

    const patches = await this.diffCalculator.generatePatches(diff);
    const estimatedPatchSize = this.estimatePatchSize(patches);
    const compressionRatio = (tracker.currentVersion.size - estimatedPatchSize) / tracker.currentVersion.size;

    return {
      id: this.generateChangeId(),
      previousVersion: sinceVersion,
      currentVersion: tracker.currentVersion.version,
      diff,
      patches,
      compressionRatio,
      metadata: {
        source: stateKey,
        timestamp: tracker.currentVersion.timestamp,
        dataType: typeof tracker.currentVersion.data,
        estimatedSavings: Math.round(((tracker.currentVersion.size - estimatedPatchSize) / 1024))
      }
    };
  }

  /**
   * Clear state and history
   */
  clearState(stateKey: string): void {
    const tracker = this.stateTrackers.get(stateKey);
    if (tracker) {
      // Notify all subscriptions that state is cleared
      tracker.subscriptions.forEach(subscription => {
        this.subscriptions.delete(subscription.id);
      });

      this.stateTrackers.delete(stateKey);
      this.emit('stateCleared', { stateKey });
    }
  }

  /**
   * Get metrics about differential state management
   */
  getMetrics(): DifferentialMetrics {
    let totalStates = this.stateTrackers.size;
    let totalVersions = 0;
    let totalSubscriptions = this.subscriptions.size;
    let totalDataSize = 0;
    let averageCompressionRatio = 0;
    let compressionSamples = 0;

    for (const tracker of this.stateTrackers.values()) {
      totalVersions += tracker.previousVersions.size + (tracker.currentVersion ? 1 : 0);
      if (tracker.currentVersion) {
        totalDataSize += tracker.currentVersion.size;
      }
    }

    return {
      totalStates,
      totalVersions,
      totalSubscriptions,
      totalDataSizeBytes: totalDataSize,
      averageCompressionRatio,
      memoryUsageBytes: this.estimateMemoryUsage(),
      activeTrackers: Array.from(this.stateTrackers.keys())
    };
  }

  // Private helper methods
  private getOrCreateTracker<T>(stateKey: string, options: SetStateOptions | undefined = {}): StateTracker<T> {
    let tracker = this.stateTrackers.get(stateKey) as StateTracker<T>;

    if (!tracker) {
      tracker = {
        key: stateKey,
        currentVersion: null as any,
        previousVersions: new Map(),
        subscriptions: new Set(),
        lastUpdateTime: 0,
        compressionEnabled: (options !== undefined && options.enableCompression !== undefined) ? options.enableCompression : this.config.enableCompression,
        maxHistorySize: (options !== undefined && options.maxHistoryVersions !== undefined) ? options.maxHistoryVersions : this.config.maxHistoryVersions
      };

      this.stateTrackers.set(stateKey, tracker);
    }

    return tracker;
  }

  private notifySubscriptions(stateKey: string, stateChange: StateChange): void {
    const tracker = this.stateTrackers.get(stateKey);
    if (!tracker) return;

    tracker.subscriptions.forEach(subscription => {
      // Check if subscription should receive this update
      if (subscription.options.maxDiffSize !== undefined &&
          this.estimatePatchSize(stateChange.patches) > subscription.options.maxDiffSize) {

        if (subscription.options.fallbackToFull === true) {
          // Send full state instead of diff
          const fullStateChange: StateChange = {
            ...stateChange,
            patches: [{
              op: 'replace',
              path: '',
              value: tracker.currentVersion.data
            }],
            compressionRatio: 0
          };
          subscription.callback(fullStateChange);
        }
        return;
      }

      // Apply throttling if configured
      if (subscription.options.throttleMs !== undefined && subscription.options.throttleMs > 0) {
        setTimeout(() => subscription.callback(stateChange), subscription.options.throttleMs);
      } else {
        subscription.callback(stateChange);
      }

      subscription.lastVersion = stateChange.currentVersion;
    });
  }

  private estimatePatchSize(patches: PatchOperation[]): number {
    return JSON.stringify(patches).length;
  }

  private estimateMemoryUsage(): number {
    let total = 0;
    for (const tracker of this.stateTrackers.values()) {
      if (tracker.currentVersion) {
        total += tracker.currentVersion.size;
      }
      for (const version of tracker.previousVersions.values()) {
        total += version.size;
      }
    }
    return total;
  }

  private calculateChecksum(data: string): string {
    // Simple hash function - in production, use a more robust one
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startVersionCleanup(): void {
    setInterval(() => {
      this.cleanupOldVersions();
    }, this.config.cleanupIntervalMs);
  }

  private cleanupOldVersions(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let totalDeletedCount = 0;

    for (const tracker of this.stateTrackers.values()) {
      const versionsToDelete: number[] = [];

      for (const [version, versionData] of tracker.previousVersions.entries()) {
        if (now - versionData.timestamp > maxAge) {
          versionsToDelete.push(version);
        }
      }

      versionsToDelete.forEach(version => {
        tracker.previousVersions.delete(version);
      });

      totalDeletedCount += versionsToDelete.length;
    }

    if (totalDeletedCount > 0) {
      this.emit('versionsCleanedUp', { deletedVersions: totalDeletedCount });
    }
  }
}

// Configuration and type definitions
export interface DifferentialConfig {
  maxHistoryVersions: number;
  compressionThreshold: number;
  maxDiffSizeRatio: number;
  enableCompression: boolean;
  enableVersionCleanup: boolean;
  cleanupIntervalMs: number;
  enableMetrics: boolean;
}

export interface SetStateOptions {
  enableCompression?: boolean;
  maxHistoryVersions?: number;
  forceFullUpdate?: boolean;
}

export interface DifferentialMetrics {
  totalStates: number;
  totalVersions: number;
  totalSubscriptions: number;
  totalDataSizeBytes: number;
  averageCompressionRatio: number;
  memoryUsageBytes: number;
  activeTrackers: string[];
}

// Export singleton instance for global use
export const differentialStateManager = new DifferentialStateManager();