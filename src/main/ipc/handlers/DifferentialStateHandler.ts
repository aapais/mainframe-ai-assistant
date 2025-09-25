/**
 * Differential State IPC Handler
 *
 * Handles state management with differential updates for efficient data transfer.
 * Integrates with existing batching and caching systems.
 */

import { IpcMainInvokeEvent } from 'electron';
import {
  differentialStateManager,
  StateChange,
} from '../../../shared/utils/DifferentialStateManager';
import { IPCManager } from '../IPCManager';
import { AppError } from '../../../core/errors/AppError';

export interface DifferentialStateRequest {
  stateKey: string;
  data?: any;
  sinceVersion?: number;
  options?: {
    enableCompression?: boolean;
    maxHistoryVersions?: number;
    forceFullUpdate?: boolean;
  };
}

export interface DifferentialStateResponse<T = any> {
  type: 'full' | 'differential';
  version: number;
  data?: T;
  stateChange?: StateChange<T>;
  timestamp: number;
  compressionRatio?: number;
  estimatedSavings?: number;
}

export class DifferentialStateHandler {
  private ipcManager: IPCManager;
  private stateStorage = new Map<string, any>(); // Server-side state storage
  private compressionStats = new Map<
    string,
    {
      totalUpdates: number;
      totalSavings: number;
      averageRatio: number;
    }
  >();

  constructor(ipcManager: IPCManager) {
    this.ipcManager = ipcManager;
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Get state with differential support
    this.ipcManager.registerHandler<[string, number?], DifferentialStateResponse>(
      'state:get',
      this.handleGetState.bind(this),
      {
        cacheable: true,
        cacheTTL: 30000, // 30 seconds
        batchable: true,
        batchSize: 5,
        batchDelay: 50,
        validation: args => {
          if (!args[0] || typeof args[0] !== 'string') {
            return 'State key is required and must be a string';
          }
          return true;
        },
      }
    );

    // Update state with differential calculation
    this.ipcManager.registerHandler<[string, any], DifferentialStateResponse>(
      'state:update',
      this.handleUpdateState.bind(this),
      {
        batchable: true,
        batchSize: 3,
        batchDelay: 100,
        validation: args => {
          if (!args[0] || typeof args[0] !== 'string') {
            return 'State key is required and must be a string';
          }
          if (args[1] === undefined) {
            return 'State data is required';
          }
          return true;
        },
      }
    );

    // Get differential update since version
    this.ipcManager.registerHandler<[string, number], DifferentialStateResponse | null>(
      'state:get-differential',
      this.handleGetDifferential.bind(this),
      {
        cacheable: true,
        cacheTTL: 10000, // 10 seconds
        validation: args => {
          if (!args[0] || typeof args[0] !== 'string') {
            return 'State key is required and must be a string';
          }
          if (typeof args[1] !== 'number') {
            return 'Version number is required';
          }
          return true;
        },
      }
    );

    // Subscribe to state changes (WebSocket-style)
    this.ipcManager.registerHandler<[string], string>(
      'state:subscribe',
      this.handleSubscribe.bind(this),
      {
        validation: args => {
          if (!args[0] || typeof args[0] !== 'string') {
            return 'State key is required and must be a string';
          }
          return true;
        },
      }
    );

    // Unsubscribe from state changes
    this.ipcManager.registerHandler<[string], boolean>(
      'state:unsubscribe',
      this.handleUnsubscribe.bind(this),
      {
        validation: args => {
          if (!args[0] || typeof args[0] !== 'string') {
            return 'Subscription ID is required and must be a string';
          }
          return true;
        },
      }
    );

    // Get state metrics and compression stats
    this.ipcManager.registerHandler<[], any>(
      'state:get-metrics',
      this.handleGetMetrics.bind(this),
      {
        cacheable: true,
        cacheTTL: 5000, // 5 seconds
      }
    );

    // Clear state
    this.ipcManager.registerHandler<[string], boolean>(
      'state:clear',
      this.handleClearState.bind(this),
      {
        validation: args => {
          if (!args[0] || typeof args[0] !== 'string') {
            return 'State key is required and must be a string';
          }
          return true;
        },
      }
    );

    // Batch state operations
    this.ipcManager.registerHandler<
      [Array<{ operation: 'get' | 'update'; stateKey: string; data?: any }>],
      Array<DifferentialStateResponse>
    >('state:batch', this.handleBatchOperations.bind(this), {
      batchable: false, // Already a batch operation
      validation: args => {
        if (!Array.isArray(args[0])) {
          return 'Operations must be an array';
        }
        return true;
      },
    });

    console.log('✅ Differential state handlers registered');
  }

  private async handleGetState(
    event: IpcMainInvokeEvent,
    stateKey: string,
    sinceVersion?: number
  ): Promise<DifferentialStateResponse> {
    try {
      // Get current state from server storage
      const serverState = this.stateStorage.get(stateKey);
      if (!serverState) {
        // Initialize with empty state if not found
        await this.initializeState(stateKey, {});
        return {
          type: 'full',
          version: 1,
          data: {},
          timestamp: Date.now(),
        };
      }

      // If client has a version, try to send differential update
      if (sinceVersion && sinceVersion > 0) {
        const differential = await differentialStateManager.getDifferentialUpdate(
          stateKey,
          sinceVersion
        );

        if (differential) {
          this.updateCompressionStats(
            stateKey,
            differential.compressionRatio,
            differential.metadata.estimatedSavings
          );

          return {
            type: 'differential',
            version: differential.currentVersion,
            stateChange: differential,
            timestamp: Date.now(),
            compressionRatio: differential.compressionRatio,
            estimatedSavings: differential.metadata.estimatedSavings,
          };
        }
      }

      // Send full state
      const currentState = differentialStateManager.getState(stateKey);
      return {
        type: 'full',
        version: currentState?.version || 1,
        data: serverState,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new AppError('STATE_GET_ERROR', `Failed to get state for key: ${stateKey}`, {
        originalError: error,
        stateKey,
      });
    }
  }

  private async handleUpdateState(
    event: IpcMainInvokeEvent,
    stateKey: string,
    newData: any
  ): Promise<DifferentialStateResponse> {
    try {
      // Update server storage
      const oldData = this.stateStorage.get(stateKey);
      this.stateStorage.set(stateKey, newData);

      // Calculate differential update
      const stateChange = await differentialStateManager.setState(stateKey, newData, {
        enableCompression: true,
        maxHistoryVersions: 10,
      });

      if (stateChange) {
        this.updateCompressionStats(
          stateKey,
          stateChange.compressionRatio,
          stateChange.metadata.estimatedSavings
        );

        // Broadcast to all subscribed clients
        this.broadcastStateChange(stateKey, stateChange);

        return {
          type: 'differential',
          version: stateChange.currentVersion,
          stateChange,
          timestamp: Date.now(),
          compressionRatio: stateChange.compressionRatio,
          estimatedSavings: stateChange.metadata.estimatedSavings,
        };
      } else {
        // No changes detected
        const currentState = differentialStateManager.getState(stateKey);
        return {
          type: 'full',
          version: currentState?.version || 1,
          data: newData,
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      throw new AppError('STATE_UPDATE_ERROR', `Failed to update state for key: ${stateKey}`, {
        originalError: error,
        stateKey,
      });
    }
  }

  private async handleGetDifferential(
    event: IpcMainInvokeEvent,
    stateKey: string,
    sinceVersion: number
  ): Promise<DifferentialStateResponse | null> {
    try {
      const differential = await differentialStateManager.getDifferentialUpdate(
        stateKey,
        sinceVersion
      );

      if (!differential) {
        return null;
      }

      this.updateCompressionStats(
        stateKey,
        differential.compressionRatio,
        differential.metadata.estimatedSavings
      );

      return {
        type: 'differential',
        version: differential.currentVersion,
        stateChange: differential,
        timestamp: Date.now(),
        compressionRatio: differential.compressionRatio,
        estimatedSavings: differential.metadata.estimatedSavings,
      };
    } catch (error) {
      throw new AppError(
        'DIFFERENTIAL_GET_ERROR',
        `Failed to get differential update for key: ${stateKey}`,
        { originalError: error, stateKey, sinceVersion }
      );
    }
  }

  private async handleSubscribe(event: IpcMainInvokeEvent, stateKey: string): Promise<string> {
    try {
      const subscriptionId = differentialStateManager.subscribe(
        stateKey,
        stateChange => {
          // Send change notification to client
          event.sender.send('state:change', {
            subscriptionId,
            stateKey,
            stateChange,
            timestamp: Date.now(),
          });
        },
        {
          immediate: true,
          throttleMs: 100,
          maxDiffSize: 50 * 1024, // 50KB
          fallbackToFull: true,
        }
      );

      return subscriptionId;
    } catch (error) {
      throw new AppError('STATE_SUBSCRIBE_ERROR', `Failed to subscribe to state: ${stateKey}`, {
        originalError: error,
        stateKey,
      });
    }
  }

  private async handleUnsubscribe(
    event: IpcMainInvokeEvent,
    subscriptionId: string
  ): Promise<boolean> {
    try {
      differentialStateManager.unsubscribe(subscriptionId);
      return true;
    } catch (error) {
      console.warn('Failed to unsubscribe:', error);
      return false;
    }
  }

  private async handleGetMetrics(event: IpcMainInvokeEvent): Promise<any> {
    try {
      const globalMetrics = differentialStateManager.getMetrics();
      const compressionMetrics = Array.from(this.compressionStats.entries()).map(
        ([stateKey, stats]) => ({
          stateKey,
          ...stats,
        })
      );

      return {
        global: globalMetrics,
        compression: compressionMetrics,
        serverStates: Array.from(this.stateStorage.keys()).length,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new AppError('METRICS_GET_ERROR', 'Failed to get differential state metrics', {
        originalError: error,
      });
    }
  }

  private async handleClearState(event: IpcMainInvokeEvent, stateKey: string): Promise<boolean> {
    try {
      this.stateStorage.delete(stateKey);
      differentialStateManager.clearState(stateKey);
      this.compressionStats.delete(stateKey);

      // Notify subscribers that state was cleared
      event.sender.send('state:cleared', { stateKey, timestamp: Date.now() });

      return true;
    } catch (error) {
      console.warn('Failed to clear state:', error);
      return false;
    }
  }

  private async handleBatchOperations(
    event: IpcMainInvokeEvent,
    operations: Array<{ operation: 'get' | 'update'; stateKey: string; data?: any }>
  ): Promise<Array<DifferentialStateResponse>> {
    const results: Array<DifferentialStateResponse> = [];

    for (const op of operations) {
      try {
        let result: DifferentialStateResponse;

        if (op.operation === 'get') {
          result = await this.handleGetState(event, op.stateKey);
        } else if (op.operation === 'update') {
          result = await this.handleUpdateState(event, op.stateKey, op.data);
        } else {
          throw new Error(`Unknown operation: ${op.operation}`);
        }

        results.push(result);
      } catch (error) {
        // For batch operations, include errors in response rather than throwing
        results.push({
          type: 'full',
          version: 0,
          data: null,
          timestamp: Date.now(),
          // @ts-ignore - adding error to response for batch context
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  // Helper methods
  private async initializeState(stateKey: string, initialData: any): Promise<void> {
    this.stateStorage.set(stateKey, initialData);
    await differentialStateManager.setState(stateKey, initialData);
  }

  private updateCompressionStats(
    stateKey: string,
    compressionRatio: number,
    savings: number
  ): void {
    const existing = this.compressionStats.get(stateKey) || {
      totalUpdates: 0,
      totalSavings: 0,
      averageRatio: 0,
    };

    existing.totalUpdates++;
    existing.totalSavings += savings;
    existing.averageRatio =
      (existing.averageRatio * (existing.totalUpdates - 1) + compressionRatio) /
      existing.totalUpdates;

    this.compressionStats.set(stateKey, existing);
  }

  private broadcastStateChange(stateKey: string, stateChange: StateChange): void {
    // In a full implementation, this would broadcast to all subscribed clients
    // For now, we'll emit an event that the main process can handle
    this.ipcManager.emit('state:broadcast', {
      stateKey,
      stateChange,
      timestamp: Date.now(),
    });
  }

  /**
   * Initialize common application states
   */
  public async initializeCommonStates(): Promise<void> {
    const commonStates = [
      { key: 'dashboard-metrics', data: {} },
      { key: 'search-results', data: [] },
      { key: 'kb-entries', data: [] },
      { key: 'user-preferences', data: {} },
      { key: 'system-health', data: { status: 'unknown' } },
      { key: 'performance-metrics', data: {} },
    ];

    for (const state of commonStates) {
      if (!this.stateStorage.has(state.key)) {
        await this.initializeState(state.key, state.data);
        console.log(`✅ Initialized state: ${state.key}`);
      }
    }
  }

  /**
   * Get compression statistics
   */
  public getCompressionStats(): Map<string, any> {
    return new Map(this.compressionStats);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stateStorage.clear();
    this.compressionStats.clear();
    console.log('🧹 DifferentialStateHandler destroyed');
  }
}
