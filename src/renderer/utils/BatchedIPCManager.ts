/**
 * Batched IPC Manager for Renderer Process
 *
 * Aggregates multiple IPC requests into batches to improve performance
 * by reducing round-trip latency. Primary optimization target is dashboard
 * loading which currently makes 6+ separate IPC calls.
 */

import {
  BatchRequest,
  BatchResponse,
  BatchRequestPayload,
  BatchResponsePayload,
  BatchConfig,
  DASHBOARD_BATCH_CONFIG,
  SEARCH_BATCH_CONFIG,
  BatchError,
  BatchStats,
  BatchContext
} from '../../shared/types/BatchTypes';
import { differentialStateManager, StateChange } from '../../shared/utils/DifferentialStateManager';

interface PendingRequest {
  request: BatchRequest;
  resolve: (response: BatchResponse) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

interface BatchQueue {
  requests: PendingRequest[];
  timeoutId?: NodeJS.Timeout;
  config: BatchConfig;
  startTime: number;
}

export class BatchedIPCManager {
  private static instance: BatchedIPCManager | null = null;
  private pendingBatches = new Map<string, BatchQueue>();
  private batchConfigs = new Map<string, BatchConfig>();
  private stats: BatchStats = {
    totalBatches: 0,
    totalRequests: 0,
    averageBatchSize: 0,
    averageExecutionTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    timesSaved: 0
  };

  private isEnabled = true;
  private debugMode = process.env.NODE_ENV === 'development';
  private enableDifferential = true;
  private stateVersions = new Map<string, number>(); // Track local state versions

  constructor() {
    this.registerDefaultConfigs();
  }

  static getInstance(): BatchedIPCManager {
    if (!BatchedIPCManager.instance) {
      BatchedIPCManager.instance = new BatchedIPCManager();
    }
    return BatchedIPCManager.instance;
  }

  private registerDefaultConfigs() {
    this.batchConfigs.set('dashboard-load', DASHBOARD_BATCH_CONFIG);
    this.batchConfigs.set('search-operations', SEARCH_BATCH_CONFIG);
  }

  /**
   * Main method to execute a batchable request
   * Will either batch the request or execute immediately based on configuration
   */
  async executeRequest<T = any>(
    method: string,
    params?: any[],
    options: {
      batchKey?: string;
      priority?: 'low' | 'medium' | 'high';
      timeout?: number;
      bypassBatch?: boolean;
      context?: Partial<BatchContext>;
    } = {}
  ): Promise<T> {
    // If batching is disabled or explicitly bypassed, execute immediately
    if (!this.isEnabled || options.bypassBatch) {
      return this.executeSingle(method, params);
    }

    // Determine batch key (default to method category)
    const batchKey = options.batchKey || this.determineBatchKey(method);
    const config = this.batchConfigs.get(batchKey);

    // If no batch config exists, execute immediately
    if (!config) {
      if (this.debugMode) {
        console.warn(`[BatchedIPC] No batch config for method: ${method}, executing immediately`);
      }
      return this.executeSingle(method, params);
    }

    // Create batch request
    const requestId = this.generateRequestId();
    const batchRequest: BatchRequest = {
      id: requestId,
      method,
      params: params || [],
      priority: options.priority || 'medium',
      timeout: options.timeout || 5000,
      cacheable: this.isMethodCacheable(method, config),
      category: batchKey
    };

    // Return promise that will be resolved when batch executes
    return new Promise<T>((resolve, reject) => {
      this.addToBatch(batchKey, {
        request: batchRequest,
        resolve: (response: BatchResponse) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Batch request failed'));
          }
        },
        reject,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Execute dashboard batch - optimized for dashboard loading
   * This combines all 6 dashboard calls into a single batch
   */
  async executeDashboardBatch(): Promise<{
    metrics?: any;
    performanceMetrics?: any;
    healthStatus?: any;
    kbStats?: any;
    recentQueries?: any;
    storageInfo?: any;
  }> {
    const batchPromises = {
      metrics: this.executeRequest('system:get-metrics', [], { batchKey: 'dashboard-load' }),
      performanceMetrics: this.executeRequest('system:get-performance-metrics', [], { batchKey: 'dashboard-load' }),
      healthStatus: this.executeRequest('system:get-health-status', [], { batchKey: 'dashboard-load' }),
      kbStats: this.executeRequest('kb:get-stats', [], { batchKey: 'dashboard-load' }),
      recentQueries: this.executeRequest('search:get-recent-queries', [10], { batchKey: 'dashboard-load' }),
      storageInfo: this.executeRequest('system:get-storage-info', [], { batchKey: 'dashboard-load' })
    };

    try {
      const results = await Promise.allSettled([
        batchPromises.metrics.catch(e => ({ error: e.message })),
        batchPromises.performanceMetrics.catch(e => ({ error: e.message })),
        batchPromises.healthStatus.catch(e => ({ error: e.message })),
        batchPromises.kbStats.catch(e => ({ error: e.message })),
        batchPromises.recentQueries.catch(e => ({ error: e.message })),
        batchPromises.storageInfo.catch(e => ({ error: e.message }))
      ]);

      return {
        metrics: results[0].status === 'fulfilled' ? results[0].value : undefined,
        performanceMetrics: results[1].status === 'fulfilled' ? results[1].value : undefined,
        healthStatus: results[2].status === 'fulfilled' ? results[2].value : undefined,
        kbStats: results[3].status === 'fulfilled' ? results[3].value : undefined,
        recentQueries: results[4].status === 'fulfilled' ? results[4].value : undefined,
        storageInfo: results[5].status === 'fulfilled' ? results[5].value : undefined
      };
    } catch (error) {
      console.error('[BatchedIPC] Dashboard batch execution failed:', error);
      throw error;
    }
  }

  private addToBatch(batchKey: string, pendingRequest: PendingRequest) {
    const config = this.batchConfigs.get(batchKey)!;

    // Get or create batch queue
    let batch = this.pendingBatches.get(batchKey);
    if (!batch) {
      batch = {
        requests: [],
        config,
        startTime: Date.now()
      };
      this.pendingBatches.set(batchKey, batch);
    }

    // Add request to batch
    batch.requests.push(pendingRequest);

    // Clear existing timeout
    if (batch.timeoutId) {
      clearTimeout(batch.timeoutId);
    }

    // Check if we should execute immediately
    const shouldExecuteNow =
      batch.requests.length >= config.maxBatchSize ||
      pendingRequest.request.priority === 'high';

    if (shouldExecuteNow) {
      this.executeBatch(batchKey);
    } else {
      // Set timeout to execute batch
      batch.timeoutId = setTimeout(() => {
        this.executeBatch(batchKey);
      }, config.maxWaitTime);
    }
  }

  private async executeBatch(batchKey: string) {
    const batch = this.pendingBatches.get(batchKey);
    if (!batch || batch.requests.length === 0) {
      return;
    }

    // Remove batch from pending
    this.pendingBatches.delete(batchKey);

    // Clear timeout
    if (batch.timeoutId) {
      clearTimeout(batch.timeoutId);
    }

    const batchId = this.generateBatchId();
    const startTime = Date.now();

    try {
      if (this.debugMode) {
        console.log(`[BatchedIPC] Executing batch ${batchKey} with ${batch.requests.length} requests`);
      }

      // Create batch payload
      const payload: BatchRequestPayload = {
        requests: batch.requests.map(pr => pr.request),
        batchId,
        timestamp: startTime,
        priority: this.determineBatchPriority(batch.requests),
        metadata: {
          source: batchKey,
          version: '1.0'
        }
      };

      // Execute batch via IPC
      const response = await this.executeBatchIPC(payload);

      // Process responses
      this.processBatchResponse(batch.requests, response);

      // Update stats
      this.updateStats(batch, Date.now() - startTime, response);

    } catch (error) {
      console.error(`[BatchedIPC] Batch execution failed for ${batchKey}:`, error);

      // Reject all pending requests
      batch.requests.forEach(pending => {
        pending.reject(new Error(`Batch execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      });
    }
  }

  private async executeBatchIPC(payload: BatchRequestPayload): Promise<BatchResponsePayload> {
    // Use the batch processing API
    if (window.electronAPI?.batch?.execute) {
      const response = await window.electronAPI.batch.execute(payload);
      return response.success ? response.data : Promise.reject(response.error);
    }

    // Fallback: execute requests individually (defeats the purpose but provides compatibility)
    console.warn('[BatchedIPC] Batch IPC not available, falling back to individual requests');

    const responses: BatchResponse[] = [];
    let cacheHits = 0;
    let errors = 0;

    for (const request of payload.requests) {
      try {
        const startTime = Date.now();
        const result = await this.executeSingle(request.method, request.params);

        responses.push({
          id: request.id,
          success: true,
          data: result,
          metadata: {
            executionTime: Date.now() - startTime,
            fromBatch: true,
            cached: false
          }
        });
      } catch (error) {
        errors++;
        responses.push({
          id: request.id,
          success: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }

    return {
      responses,
      batchId: payload.batchId,
      timestamp: Date.now(),
      metadata: {
        totalExecutionTime: Date.now() - payload.timestamp,
        cacheHits,
        errors,
        processed: responses.length
      }
    };
  }

  private async executeSingle<T = any>(method: string, params?: any[]): Promise<T> {
    // Map method to actual electronAPI call
    const methodParts = method.split(':');
    const namespace = methodParts[0];
    const methodName = methodParts[1];

    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    const api = (window.electronAPI as any)[namespace];
    if (!api || typeof api[methodName] !== 'function') {
      throw new Error(`Method ${method} not found in Electron API`);
    }

    const result = await api[methodName](...(params || []));

    // Handle the enhanced response format
    if (result && typeof result === 'object' && 'success' in result) {
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error?.message || 'Request failed');
      }
    }

    return result;
  }

  private processBatchResponse(requests: PendingRequest[], response: BatchResponsePayload) {
    const responseMap = new Map(response.responses.map(r => [r.id, r]));

    requests.forEach(pending => {
      const batchResponse = responseMap.get(pending.request.id);
      if (batchResponse) {
        pending.resolve(batchResponse);
      } else {
        pending.reject(new Error('Response not found in batch'));
      }
    });
  }

  private updateStats(batch: BatchQueue, executionTime: number, response: BatchResponsePayload) {
    this.stats.totalBatches++;
    this.stats.totalRequests += batch.requests.length;
    this.stats.averageBatchSize = this.stats.totalRequests / this.stats.totalBatches;
    this.stats.averageExecutionTime =
      (this.stats.averageExecutionTime * (this.stats.totalBatches - 1) + executionTime) / this.stats.totalBatches;
    this.stats.cacheHitRate =
      (this.stats.cacheHitRate * (this.stats.totalBatches - 1) + response.metadata.cacheHits / batch.requests.length) / this.stats.totalBatches;
    this.stats.errorRate =
      (this.stats.errorRate * (this.stats.totalBatches - 1) + response.metadata.errors / batch.requests.length) / this.stats.totalBatches;

    // Estimate time saved (assuming each individual request would take ~200ms)
    const timeIfIndividual = batch.requests.length * 200;
    const timeSaved = Math.max(0, timeIfIndividual - executionTime);
    this.stats.timesSaved += timeSaved;
  }

  // Utility methods
  private determineBatchKey(method: string): string {
    if (method.startsWith('system:') || method.startsWith('kb:get-stats')) {
      return 'dashboard-load';
    }
    if (method.startsWith('search:')) {
      return 'search-operations';
    }
    return 'default';
  }

  private isMethodCacheable(method: string, config: BatchConfig): boolean {
    const requestConfig = config.requests.find(r => r.method === method);
    return requestConfig?.cacheable ?? true;
  }

  private determineBatchPriority(requests: PendingRequest[]): 'low' | 'medium' | 'high' {
    const priorities = requests.map(r => r.request.priority || 'medium');
    if (priorities.includes('high')) return 'high';
    if (priorities.includes('medium')) return 'medium';
    return 'low';
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for configuration and monitoring
  public getStats(): BatchStats {
    return { ...this.stats };
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  public isEnabledStatus(): boolean {
    return this.isEnabled;
  }

  public clearStats() {
    this.stats = {
      totalBatches: 0,
      totalRequests: 0,
      averageBatchSize: 0,
      averageExecutionTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      timesSaved: 0
    };
  }

  public addBatchConfig(key: string, config: BatchConfig) {
    this.batchConfigs.set(key, config);
  }

  public removeBatchConfig(key: string) {
    this.batchConfigs.delete(key);
  }

  // ==========================================
  // Differential State Management Methods
  // ==========================================

  /**
   * Execute state request with differential optimization
   */
  async executeStateRequest<T = any>(
    stateKey: string,
    operation: 'get' | 'update',
    data?: T,
    options: {
      enableDifferential?: boolean;
      forceFullUpdate?: boolean;
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<T> {
    const {
      enableDifferential = this.enableDifferential,
      forceFullUpdate = false,
      priority = 'medium'
    } = options;

    if (!enableDifferential || forceFullUpdate) {
      // Standard request without differential optimization
      return this.executeRequest(
        `state:${operation}`,
        operation === 'get' ? [stateKey] : [stateKey, data],
        { priority, batchKey: 'state-operations' }
      );
    }

    // Differential optimized request
    if (operation === 'get') {
      return this.executeDifferentialGet<T>(stateKey, priority);
    } else if (operation === 'update') {
      return this.executeDifferentialUpdate<T>(stateKey, data!, priority);
    }

    throw new Error(`Unsupported state operation: ${operation}`);
  }

  /**
   * Get state with differential optimization
   */
  private async executeDifferentialGet<T>(
    stateKey: string,
    priority: 'low' | 'medium' | 'high'
  ): Promise<T> {
    try {
      const localVersion = this.stateVersions.get(stateKey) || 0;

      if (localVersion > 0) {
        // Try to get differential update first
        const differential = await this.executeRequest<{
          type: 'full' | 'differential';
          version: number;
          data?: T;
          stateChange?: StateChange<T>;
          compressionRatio?: number;
          estimatedSavings?: number;
        }>(
          'state:get-differential',
          [stateKey, localVersion],
          { priority, batchKey: 'differential-state' }
        );

        if (differential && differential.type === 'differential' && differential.stateChange) {
          // Apply differential update
          const currentData = await this.getLocalStateData<T>(stateKey);
          if (currentData) {
            const updatedData = await differentialStateManager.applyDifferentialUpdate(
              stateKey,
              localVersion,
              differential.stateChange
            );

            if (updatedData) {
              this.stateVersions.set(stateKey, differential.version);
              this.updateDifferentialStats(differential.compressionRatio, differential.estimatedSavings);

              if (this.debugMode) {
                console.log(
                  `[Differential] Updated ${stateKey} from v${localVersion} to v${differential.version}`,
                  `(${differential.compressionRatio?.toFixed(2)} compression, ${differential.estimatedSavings}KB saved)`
                );
              }

              return updatedData;
            }
          }
        }
      }

      // Fall back to full state request
      const fullState = await this.executeRequest<{
        type: 'full';
        version: number;
        data: T;
      }>(
        'state:get',
        [stateKey],
        { priority, batchKey: 'state-operations' }
      );

      if (fullState && fullState.data) {
        // Update local state tracking
        await differentialStateManager.setState(stateKey, fullState.data);
        this.stateVersions.set(stateKey, fullState.version);

        if (this.debugMode) {
          console.log(`[Differential] Full state loaded for ${stateKey} (v${fullState.version})`);
        }

        return fullState.data;
      }

      throw new Error('No data received from state request');

    } catch (error) {
      console.error(`[Differential] Failed to get state ${stateKey}:`, error);

      // Final fallback to basic request
      return this.executeRequest<T>(
        `state:get`,
        [stateKey],
        { priority, bypassBatch: true }
      );
    }
  }

  /**
   * Update state with differential calculation
   */
  private async executeDifferentialUpdate<T>(
    stateKey: string,
    newData: T,
    priority: 'low' | 'medium' | 'high'
  ): Promise<T> {
    try {
      // Calculate differential locally first
      const localStateChange = await differentialStateManager.setState(stateKey, newData);

      if (localStateChange && localStateChange.compressionRatio > 0.1) {
        // Send differential update if it provides significant savings
        const response = await this.executeRequest<{
          type: 'differential';
          version: number;
          stateChange: StateChange<T>;
          compressionRatio?: number;
          estimatedSavings?: number;
        }>(
          'state:update-differential',
          [stateKey, localStateChange],
          { priority, batchKey: 'differential-state' }
        );

        if (response) {
          this.stateVersions.set(stateKey, response.version);
          this.updateDifferentialStats(response.compressionRatio, response.estimatedSavings);

          if (this.debugMode) {
            console.log(
              `[Differential] Updated ${stateKey} differentially to v${response.version}`,
              `(${response.compressionRatio?.toFixed(2)} compression, ${response.estimatedSavings}KB saved)`
            );
          }

          return newData;
        }
      }

      // Fall back to full update
      const fullUpdate = await this.executeRequest<{
        version: number;
      }>(
        'state:update',
        [stateKey, newData],
        { priority, batchKey: 'state-operations' }
      );

      if (fullUpdate) {
        this.stateVersions.set(stateKey, fullUpdate.version);
      }

      return newData;

    } catch (error) {
      console.error(`[Differential] Failed to update state ${stateKey}:`, error);
      throw error;
    }
  }

  /**
   * Execute dashboard batch with differential optimization
   */
  async executeDifferentialDashboardBatch(): Promise<{
    metrics?: any;
    performanceMetrics?: any;
    healthStatus?: any;
    kbStats?: any;
    recentQueries?: any;
    storageInfo?: any;
  }> {
    const stateKeys = [
      'dashboard-metrics',
      'performance-metrics',
      'health-status',
      'kb-stats',
      'recent-queries',
      'storage-info'
    ];

    const batchPromises = stateKeys.reduce((promises, stateKey) => {
      const promiseKey = stateKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      promises[promiseKey] = this.executeStateRequest(stateKey, 'get', undefined, {
        enableDifferential: true,
        priority: 'high'
      });
      return promises;
    }, {} as any);

    try {
      const results = await Promise.allSettled([
        batchPromises.dashboardMetrics.catch((e: any) => ({ error: e.message })),
        batchPromises.performanceMetrics.catch((e: any) => ({ error: e.message })),
        batchPromises.healthStatus.catch((e: any) => ({ error: e.message })),
        batchPromises.kbStats.catch((e: any) => ({ error: e.message })),
        batchPromises.recentQueries.catch((e: any) => ({ error: e.message })),
        batchPromises.storageInfo.catch((e: any) => ({ error: e.message }))
      ]);

      return {
        metrics: results[0].status === 'fulfilled' ? results[0].value : undefined,
        performanceMetrics: results[1].status === 'fulfilled' ? results[1].value : undefined,
        healthStatus: results[2].status === 'fulfilled' ? results[2].value : undefined,
        kbStats: results[3].status === 'fulfilled' ? results[3].value : undefined,
        recentQueries: results[4].status === 'fulfilled' ? results[4].value : undefined,
        storageInfo: results[5].status === 'fulfilled' ? results[5].value : undefined
      };
    } catch (error) {
      console.error('[Differential] Dashboard batch execution failed:', error);
      throw error;
    }
  }

  /**
   * Subscribe to state changes
   */
  async subscribeToState<T>(
    stateKey: string,
    callback: (data: T, change?: StateChange<T>) => void
  ): Promise<string> {
    try {
      const subscriptionId = await this.executeRequest<string>(
        'state:subscribe',
        [stateKey],
        { bypassBatch: true, priority: 'high' }
      );

      // Set up IPC event listener for state changes
      if (window.electronAPI?.on) {
        window.electronAPI.on('state:change', (event: any) => {
          if (event.subscriptionId === subscriptionId && event.stateKey === stateKey) {
            if (event.stateChange) {
              // Apply differential update locally
              differentialStateManager.applyDifferentialUpdate(
                stateKey,
                this.stateVersions.get(stateKey) || 0,
                event.stateChange
              ).then((updatedData) => {
                if (updatedData) {
                  this.stateVersions.set(stateKey, event.stateChange.currentVersion);
                  callback(updatedData, event.stateChange);
                }
              }).catch((error) => {
                console.error('Failed to apply state change:', error);
                // Fall back to full state request
                this.executeStateRequest<T>(stateKey, 'get', undefined, { forceFullUpdate: true })
                  .then(data => callback(data))
                  .catch(console.error);
              });
            }
          }
        });
      }

      return subscriptionId;
    } catch (error) {
      console.error('Failed to subscribe to state:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from state changes
   */
  async unsubscribeFromState(subscriptionId: string): Promise<void> {
    try {
      await this.executeRequest(
        'state:unsubscribe',
        [subscriptionId],
        { bypassBatch: true }
      );
    } catch (error) {
      console.error('Failed to unsubscribe from state:', error);
    }
  }

  /**
   * Get differential state metrics
   */
  async getDifferentialMetrics(): Promise<any> {
    try {
      return this.executeRequest(
        'state:get-metrics',
        [],
        { batchKey: 'metrics', priority: 'low' }
      );
    } catch (error) {
      console.error('Failed to get differential metrics:', error);
      return null;
    }
  }

  // Private helper methods for differential operations

  private async getLocalStateData<T>(stateKey: string): Promise<T | null> {
    const state = differentialStateManager.getState<T>(stateKey);
    return state?.data || null;
  }

  private updateDifferentialStats(compressionRatio?: number, estimatedSavings?: number): void {
    if (compressionRatio && compressionRatio > 0) {
      // Update internal statistics for differential transfers
      this.stats.timesSaved += estimatedSavings || 0;
    }
  }

  /**
   * Enable or disable differential optimization
   */
  public setDifferentialEnabled(enabled: boolean): void {
    this.enableDifferential = enabled;
  }

  /**
   * Check if differential optimization is enabled
   */
  public isDifferentialEnabled(): boolean {
    return this.enableDifferential;
  }

  /**
   * Clear local state versions (force full updates)
   */
  public clearStateVersions(): void {
    this.stateVersions.clear();
  }

  /**
   * Get current state versions
   */
  public getStateVersions(): Map<string, number> {
    return new Map(this.stateVersions);
  }
}

// Export singleton instance
export const batchedIPC = BatchedIPCManager.getInstance();