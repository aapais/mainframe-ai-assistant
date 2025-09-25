import { Diff } from './DiffCalculator';
import { PatchOperation } from './PatchApplicator';
import { EventEmitter } from 'events';
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
    immediate?: boolean;
    throttleMs?: number;
    maxDiffSize?: number;
    fallbackToFull?: boolean;
  };
}
export declare class DifferentialStateManager extends EventEmitter {
  private stateTrackers;
  private diffCalculator;
  private patchApplicator;
  private subscriptions;
  private globalVersion;
  private config;
  constructor(config?: Partial<DifferentialConfig>);
  setState<T>(stateKey: string, data: T, options?: SetStateOptions): Promise<StateChange<T> | null>;
  getState<T>(stateKey: string): StateVersion<T> | null;
  getStateVersion<T>(stateKey: string, version: number): StateVersion<T> | null;
  applyDifferentialUpdate<T>(
    stateKey: string,
    baseVersion: number,
    stateChange: StateChange<T>
  ): Promise<T | null>;
  subscribe<T>(
    stateKey: string,
    callback: (change: StateChange<T>) => void,
    options?: Partial<StateSubscription['options']>
  ): string;
  unsubscribe(subscriptionId: string): void;
  getDifferentialUpdate<T>(stateKey: string, sinceVersion: number): Promise<StateChange<T> | null>;
  clearState(stateKey: string): void;
  getMetrics(): DifferentialMetrics;
  private getOrCreateTracker;
  private notifySubscriptions;
  private estimatePatchSize;
  private estimateMemoryUsage;
  private calculateChecksum;
  private generateChangeId;
  private generateSubscriptionId;
  private startVersionCleanup;
  private cleanupOldVersions;
}
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
export declare const differentialStateManager: DifferentialStateManager;
//# sourceMappingURL=DifferentialStateManager.d.ts.map
