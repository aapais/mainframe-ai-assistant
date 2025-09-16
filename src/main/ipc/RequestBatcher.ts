import { IpcMainInvokeEvent } from 'electron';
import { EventEmitter } from 'events';
import { AppError } from '../../core/errors/AppError';
import type { IPCRequest, IPCHandler } from './IPCManager';

export interface BatchRequest {
  id: string;
  request: IPCRequest;
  handler: IPCHandler;
  event: IpcMainInvokeEvent;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timestamp: number;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxDelayMs: number;
  maxConcurrentBatches: number;
}

export interface BatchMetrics {
  totalBatches: number;
  totalRequests: number;
  averageBatchSize: number;
  averageProcessingTime: number;
  failedBatches: number;
}

/**
 * Request Batcher for optimizing similar IPC operations
 * Automatically aggregates similar requests and processes them in batches
 */
export class RequestBatcher extends EventEmitter {
  private batches = new Map<string, BatchRequest[]>();
  private timers = new Map<string, NodeJS.Timeout>();
  private config: BatchConfig;
  private metrics: BatchMetrics;
  private activeBatches = new Set<string>();
  private ipcManager: any; // Reference to IPCManager for callbacks

  constructor(ipcManager: any, config: Partial<BatchConfig> = {}) {
    super();
    
    this.ipcManager = ipcManager;
    this.config = {
      maxBatchSize: 50,
      maxDelayMs: 100,
      maxConcurrentBatches: 10,
      ...config
    };

    this.metrics = {
      totalBatches: 0,
      totalRequests: 0,
      averageBatchSize: 0,
      averageProcessingTime: 0,
      failedBatches: 0
    };

    console.log('📦 RequestBatcher initialized', this.config);
  }

  /**
   * Add a request to a batch for processing
   */
  async addRequest(
    request: IPCRequest,
    handler: IPCHandler,
    event: IpcMainInvokeEvent
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const batchKey = this.generateBatchKey(request.channel, request.data);
      const batchRequest: BatchRequest = {
        id: request.id,
        request,
        handler,
        event,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // Check if we're at max concurrent batches
      if (this.activeBatches.size >= this.config.maxConcurrentBatches) {
        reject(new AppError('BATCH_MAX_CONCURRENT', 'Maximum concurrent batches reached'));
        return;
      }

      // Add to batch
      if (!this.batches.has(batchKey)) {
        this.batches.set(batchKey, []);
      }

      const batch = this.batches.get(batchKey)!;
      batch.push(batchRequest);

      console.log(`📦 Added request to batch ${batchKey}, size: ${batch.length}`);

      // Process batch immediately if it reaches max size
      if (batch.length >= this.config.maxBatchSize) {
        this.processBatch(batchKey);
      } else {
        // Set or reset timer for batch processing
        this.setBatchTimer(batchKey);
      }
    });
  }

  /**
   * Generate a batch key based on channel and data similarity
   */
  private generateBatchKey(channel: string, data: any[]): string {
    // For similar operations, we can batch them together
    // This is a simplified approach - in practice, you might want more sophisticated grouping
    const operation = this.extractOperation(channel, data);
    return `${channel}:${operation}`;
  }

  /**
   * Extract operation type for batching similar requests
   */
  private extractOperation(channel: string, data: any[]): string {
    // Extract common patterns that can be batched
    switch (channel) {
      case 'db:search':
        return 'search'; // All searches can potentially be batched
      case 'db:getEntry':
        return 'getEntry'; // Multiple entry retrievals
      case 'db:recordUsage':
        return 'recordUsage'; // Usage tracking can be batched
      case 'ai:explainError':
        return 'explainError'; // Error explanations
      default:
        return 'default';
    }
  }

  /**
   * Set or reset the batch processing timer
   */
  private setBatchTimer(batchKey: string): void {
    // Clear existing timer
    if (this.timers.has(batchKey)) {
      clearTimeout(this.timers.get(batchKey)!);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.processBatch(batchKey);
    }, this.config.maxDelayMs);

    this.timers.set(batchKey, timer);
  }

  /**
   * Process a batch of requests
   */
  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch || batch.length === 0) return;

    // Mark batch as active
    this.activeBatches.add(batchKey);

    // Clear timer
    if (this.timers.has(batchKey)) {
      clearTimeout(this.timers.get(batchKey)!);
      this.timers.delete(batchKey);
    }

    // Remove batch from pending
    this.batches.delete(batchKey);

    const startTime = Date.now();
    const batchSize = batch.length;

    console.log(`🚀 Processing batch ${batchKey} with ${batchSize} requests`);

    try {
      // Process based on batch type
      await this.executeBatch(batchKey, batch);

      // Update metrics
      this.updateMetrics(batchSize, Date.now() - startTime, false);
      
      console.log(`✅ Batch ${batchKey} processed successfully in ${Date.now() - startTime}ms`);

    } catch (error) {
      console.error(`❌ Batch ${batchKey} failed:`, error);
      
      // Reject all requests in the failed batch
      batch.forEach(req => {
        req.reject(error);
      });

      this.updateMetrics(batchSize, Date.now() - startTime, true);
      this.emit('batchError', { batchKey, error, batchSize });
    } finally {
      // Mark batch as no longer active
      this.activeBatches.delete(batchKey);
    }
  }

  /**
   * Execute a batch based on its type
   */
  private async executeBatch(batchKey: string, batch: BatchRequest[]): Promise<void> {
    const [channel, operation] = batchKey.split(':');

    switch (operation) {
      case 'search':
        await this.executeBatchedSearch(batch);
        break;
      case 'getEntry':
        await this.executeBatchedGetEntry(batch);
        break;
      case 'recordUsage':
        await this.executeBatchedRecordUsage(batch);
        break;
      case 'explainError':
        await this.executeBatchedExplainError(batch);
        break;
      default:
        // For unknown operations, process individually but in parallel
        await this.executeParallelBatch(batch);
        break;
    }
  }

  /**
   * Execute batched search operations
   */
  private async executeBatchedSearch(batch: BatchRequest[]): Promise<void> {
    // Group similar searches together
    const searchGroups = new Map<string, BatchRequest[]>();
    
    batch.forEach(req => {
      const query = req.request.data[0] || '';
      const normalizedQuery = query.toLowerCase().trim();
      
      if (!searchGroups.has(normalizedQuery)) {
        searchGroups.set(normalizedQuery, []);
      }
      searchGroups.get(normalizedQuery)!.push(req);
    });

    // Process each group
    for (const [query, requests] of searchGroups) {
      try {
        // Execute search once for all similar queries
        const result = await requests[0].handler(requests[0].event, query, requests[0].request.data[1]);
        
        // Resolve all requests with the same result
        requests.forEach(req => req.resolve(result));
        
      } catch (error) {
        // Reject all requests in this group
        requests.forEach(req => req.reject(error));
      }
    }
  }

  /**
   * Execute batched entry retrieval
   */
  private async executeBatchedGetEntry(batch: BatchRequest[]): Promise<void> {
    // Extract all entry IDs
    const entryIds = batch.map(req => req.request.data[0]);
    const uniqueIds = [...new Set(entryIds)];

    try {
      // This would ideally be a single database query for multiple IDs
      // For now, we'll process in parallel but could be optimized
      const results = await Promise.all(
        uniqueIds.map(async (id) => {
          const request = batch.find(req => req.request.data[0] === id)!;
          return {
            id,
            result: await request.handler(request.event, id)
          };
        })
      );

      // Map results back to requests
      const resultMap = new Map(results.map(r => [r.id, r.result]));
      batch.forEach(req => {
        const entryId = req.request.data[0];
        req.resolve(resultMap.get(entryId));
      });

    } catch (error) {
      batch.forEach(req => req.reject(error));
    }
  }

  /**
   * Execute batched usage recording
   */
  private async executeBatchedRecordUsage(batch: BatchRequest[]): Promise<void> {
    try {
      // Group usage records by entry ID for potential optimization
      const usageGroups = new Map<string, { successful: number; failed: number; userId?: string }>();
      
      batch.forEach(req => {
        const [entryId, successful, userId] = req.request.data;
        if (!usageGroups.has(entryId)) {
          usageGroups.set(entryId, { successful: 0, failed: 0, userId });
        }
        
        const group = usageGroups.get(entryId)!;
        if (successful) {
          group.successful++;
        } else {
          group.failed++;
        }
      });

      // Process batched usage records
      for (const [entryId, usage] of usageGroups) {
        // This could be optimized to update usage counts in batch
        if (usage.successful > 0) {
          await batch[0].handler(batch[0].event, entryId, true, usage.userId);
        }
        if (usage.failed > 0) {
          await batch[0].handler(batch[0].event, entryId, false, usage.userId);
        }
      }

      // Resolve all requests
      batch.forEach(req => req.resolve(undefined));

    } catch (error) {
      batch.forEach(req => req.reject(error));
    }
  }

  /**
   * Execute batched AI error explanations
   */
  private async executeBatchedExplainError(batch: BatchRequest[]): Promise<void> {
    // Group by error code
    const errorGroups = new Map<string, BatchRequest[]>();
    
    batch.forEach(req => {
      const errorCode = req.request.data[0] || '';
      if (!errorGroups.has(errorCode)) {
        errorGroups.set(errorCode, []);
      }
      errorGroups.get(errorCode)!.push(req);
    });

    // Process each error code once
    for (const [errorCode, requests] of errorGroups) {
      try {
        const explanation = await requests[0].handler(requests[0].event, errorCode);
        requests.forEach(req => req.resolve(explanation));
      } catch (error) {
        requests.forEach(req => req.reject(error));
      }
    }
  }

  /**
   * Execute batch in parallel for unknown operations
   */
  private async executeParallelBatch(batch: BatchRequest[]): Promise<void> {
    const promises = batch.map(async (req) => {
      try {
        const result = await req.handler(req.event, ...req.request.data);
        req.resolve(result);
      } catch (error) {
        req.reject(error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Update batch processing metrics
   */
  private updateMetrics(batchSize: number, processingTime: number, failed: boolean): void {
    this.metrics.totalBatches++;
    this.metrics.totalRequests += batchSize;
    
    // Update average batch size
    this.metrics.averageBatchSize = this.metrics.totalRequests / this.metrics.totalBatches;
    
    // Update average processing time
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.totalBatches - 1);
    this.metrics.averageProcessingTime = (totalTime + processingTime) / this.metrics.totalBatches;
    
    if (failed) {
      this.metrics.failedBatches++;
    }
  }

  /**
   * Get batch processing metrics
   */
  getMetrics(): BatchMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current batch status
   */
  getStatus(): {
    pendingBatches: number;
    activeBatches: number;
    totalPendingRequests: number;
  } {
    let totalPendingRequests = 0;
    for (const batch of this.batches.values()) {
      totalPendingRequests += batch.length;
    }

    return {
      pendingBatches: this.batches.size,
      activeBatches: this.activeBatches.size,
      totalPendingRequests
    };
  }

  /**
   * Force process all pending batches
   */
  async flushAll(): Promise<void> {
    const batchKeys = Array.from(this.batches.keys());
    await Promise.all(batchKeys.map(key => this.processBatch(key)));
  }

  /**
   * Cleanup and destroy the batcher
   */
  destroy(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Reject all pending requests
    for (const batch of this.batches.values()) {
      batch.forEach(req => {
        req.reject(new AppError('BATCH_DESTROYED', 'RequestBatcher was destroyed'));
      });
    }

    this.batches.clear();
    this.activeBatches.clear();
    this.removeAllListeners();
    
    console.log('🧹 RequestBatcher destroyed');
  }
}