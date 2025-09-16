/**
 * Batch Processor - High-performance batch processing for large datasets
 * Handles parallel processing, progress tracking, and memory management
 */

import { EventEmitter } from 'events';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { cpus } from 'os';
import { performance } from 'perf_hooks';

export interface BatchOptions {
  batchSize?: number;
  maxConcurrency?: number;
  enableProgress?: boolean;
  enableRetry?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  memoryLimit?: number; // MB
  enableWorkerThreads?: boolean;
  checkpointInterval?: number;
}

export interface BatchResult<T> {
  data: T[];
  processingTime: number;
  totalProcessed: number;
  errors: BatchError[];
  checkpoints: BatchCheckpoint[];
  memoryUsage: MemoryUsage;
}

export interface BatchError {
  batchIndex: number;
  recordIndex: number;
  error: string;
  recoverable: boolean;
  retryCount: number;
}

export interface BatchCheckpoint {
  id: string;
  batchIndex: number;
  processedCount: number;
  timestamp: Date;
  state: any;
}

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export interface BatchProgress {
  totalBatches: number;
  processedBatches: number;
  currentBatch: number;
  percentComplete: number;
  estimatedTimeRemaining: number;
  averageBatchTime: number;
  memoryUsage: MemoryUsage;
}

export type BatchProcessor<T, R> = (items: T[]) => Promise<R[]>;
export type ProgressCallback = (progress: BatchProgress) => void;
export type ErrorCallback = (error: BatchError) => void;

/**
 * High-performance batch processor with parallel processing and monitoring
 */
export class BatchProcessor extends EventEmitter {
  private options: Required<BatchOptions>;
  private workers: Worker[] = [];
  private checkpoints = new Map<string, BatchCheckpoint>();
  private isProcessing = false;
  private memoryMonitor: NodeJS.Timeout | null = null;

  constructor(options: BatchOptions = {}) {
    super();
    
    this.options = {
      batchSize: options.batchSize || 100,
      maxConcurrency: options.maxConcurrency || Math.min(cpus().length, 4),
      enableProgress: options.enableProgress ?? true,
      enableRetry: options.enableRetry ?? true,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      memoryLimit: options.memoryLimit || 512, // 512MB default
      enableWorkerThreads: options.enableWorkerThreads ?? false,
      checkpointInterval: options.checkpointInterval || 10 // Every 10 batches
    };
  }

  /**
   * Process data in batches with parallel execution
   */
  async processBatch<T, R>(
    data: T[],
    processor: BatchProcessor<T, R>,
    progressCallback?: ProgressCallback,
    errorCallback?: ErrorCallback
  ): Promise<BatchResult<R>> {
    if (this.isProcessing) {
      throw new Error('Batch processor is already running');
    }

    this.isProcessing = true;
    const startTime = performance.now();
    
    try {
      this.startMemoryMonitoring();
      
      const batches = this.createBatches(data);
      const result: BatchResult<R> = {
        data: [],
        processingTime: 0,
        totalProcessed: 0,
        errors: [],
        checkpoints: [],
        memoryUsage: this.getMemoryUsage()
      };

      this.emit('batch:started', {
        totalBatches: batches.length,
        totalItems: data.length,
        batchSize: this.options.batchSize
      });

      // Process batches with concurrency control
      if (this.options.enableWorkerThreads && data.length > 1000) {
        result.data = await this.processWithWorkers(batches, processor, progressCallback, errorCallback);
      } else {
        result.data = await this.processSequentially(batches, processor, progressCallback, errorCallback);
      }

      result.processingTime = performance.now() - startTime;
      result.totalProcessed = data.length;
      result.checkpoints = Array.from(this.checkpoints.values());
      result.memoryUsage = this.getMemoryUsage();

      this.emit('batch:completed', result);
      return result;

    } catch (error) {
      this.emit('batch:failed', error);
      throw error;
    } finally {
      this.isProcessing = false;
      this.stopMemoryMonitoring();
      await this.cleanupWorkers();
    }
  }

  /**
   * Process with memory-efficient streaming
   */
  async processStream<T, R>(
    dataGenerator: AsyncGenerator<T[], void, unknown>,
    processor: BatchProcessor<T, R>,
    progressCallback?: ProgressCallback,
    errorCallback?: ErrorCallback
  ): Promise<AsyncGenerator<R[], void, unknown>> {
    const self = this;
    let batchIndex = 0;
    let totalProcessed = 0;

    return (async function* () {
      try {
        self.startMemoryMonitoring();
        
        for await (const batch of dataGenerator) {
          try {
            // Memory check before processing
            const memUsage = self.getMemoryUsage();
            if (memUsage.heapUsed / 1024 / 1024 > self.options.memoryLimit) {
              self.emit('memory:warning', {
                current: memUsage.heapUsed / 1024 / 1024,
                limit: self.options.memoryLimit
              });
              
              // Force garbage collection if available
              if (global.gc) {
                global.gc();
              }
            }

            const batchResult = await self.processSingleBatch(
              batch,
              batchIndex,
              processor,
              errorCallback
            );

            totalProcessed += batch.length;
            batchIndex++;

            // Create checkpoint
            if (batchIndex % self.options.checkpointInterval === 0) {
              await self.createCheckpoint(batchIndex, totalProcessed, {});
            }

            // Update progress
            if (progressCallback) {
              progressCallback({
                totalBatches: -1, // Unknown for streaming
                processedBatches: batchIndex,
                currentBatch: batchIndex,
                percentComplete: -1, // Unknown for streaming
                estimatedTimeRemaining: -1,
                averageBatchTime: 0,
                memoryUsage: self.getMemoryUsage()
              });
            }

            yield batchResult;

          } catch (error) {
            const batchError: BatchError = {
              batchIndex,
              recordIndex: -1,
              error: error.message,
              recoverable: true,
              retryCount: 0
            };

            errorCallback?.(batchError);
            self.emit('batch:error', batchError);
          }
        }
      } finally {
        self.stopMemoryMonitoring();
      }
    })();
  }

  /**
   * Resume processing from checkpoint
   */
  async resumeFromCheckpoint<T, R>(
    checkpointId: string,
    data: T[],
    processor: BatchProcessor<T, R>,
    progressCallback?: ProgressCallback,
    errorCallback?: ErrorCallback
  ): Promise<BatchResult<R>> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Resume from checkpoint position
    const remainingData = data.slice(checkpoint.processedCount);
    const result = await this.processBatch(remainingData, processor, progressCallback, errorCallback);

    // Adjust totals to include checkpoint data
    result.totalProcessed += checkpoint.processedCount;

    return result;
  }

  /**
   * Cancel current processing
   */
  async cancel(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    this.emit('batch:cancelling');
    
    // Terminate workers
    await this.cleanupWorkers();
    
    this.isProcessing = false;
    this.emit('batch:cancelled');
  }

  /**
   * Get processing statistics
   */
  getStatistics(): {
    isProcessing: boolean;
    activeWorkers: number;
    checkpointCount: number;
    memoryUsage: MemoryUsage;
  } {
    return {
      isProcessing: this.isProcessing,
      activeWorkers: this.workers.length,
      checkpointCount: this.checkpoints.size,
      memoryUsage: this.getMemoryUsage()
    };
  }

  // =========================
  // Private Methods
  // =========================

  private createBatches<T>(data: T[]): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < data.length; i += this.options.batchSize) {
      const batch = data.slice(i, i + this.options.batchSize);
      batches.push(batch);
    }
    
    return batches;
  }

  private async processSequentially<T, R>(
    batches: T[][],
    processor: BatchProcessor<T, R>,
    progressCallback?: ProgressCallback,
    errorCallback?: ErrorCallback
  ): Promise<R[]> {
    const results: R[] = [];
    const startTime = performance.now();
    let batchTimes: number[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batchStartTime = performance.now();
      
      try {
        const batchResult = await this.processSingleBatch(
          batches[i],
          i,
          processor,
          errorCallback
        );
        
        results.push(...batchResult);

        const batchTime = performance.now() - batchStartTime;
        batchTimes.push(batchTime);

        // Create checkpoint
        if ((i + 1) % this.options.checkpointInterval === 0) {
          await this.createCheckpoint(i + 1, results.length, { results });
        }

        // Update progress
        if (progressCallback) {
          const averageBatchTime = batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length;
          const remainingBatches = batches.length - (i + 1);
          const estimatedTimeRemaining = remainingBatches * averageBatchTime;

          progressCallback({
            totalBatches: batches.length,
            processedBatches: i + 1,
            currentBatch: i + 1,
            percentComplete: ((i + 1) / batches.length) * 100,
            estimatedTimeRemaining,
            averageBatchTime,
            memoryUsage: this.getMemoryUsage()
          });
        }

      } catch (error) {
        const batchError: BatchError = {
          batchIndex: i,
          recordIndex: -1,
          error: error.message,
          recoverable: true,
          retryCount: 0
        };

        errorCallback?.(batchError);
        this.emit('batch:error', batchError);

        // Continue processing other batches
      }
    }

    return results;
  }

  private async processWithWorkers<T, R>(
    batches: T[][],
    processor: BatchProcessor<T, R>,
    progressCallback?: ProgressCallback,
    errorCallback?: ErrorCallback
  ): Promise<R[]> {
    const results: R[] = [];
    const workerCount = Math.min(this.options.maxConcurrency, batches.length);
    
    // Create worker pool
    await this.createWorkerPool(workerCount);

    try {
      // Process batches in parallel using workers
      const batchPromises = batches.map((batch, index) => 
        this.processBatchWithWorker(batch, index, processor, errorCallback)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          const batchError: BatchError = {
            batchIndex: index,
            recordIndex: -1,
            error: result.reason.message,
            recoverable: false,
            retryCount: 0
          };

          errorCallback?.(batchError);
          this.emit('batch:error', batchError);
        }
      });

      // Update progress
      if (progressCallback) {
        progressCallback({
          totalBatches: batches.length,
          processedBatches: batches.length,
          currentBatch: batches.length,
          percentComplete: 100,
          estimatedTimeRemaining: 0,
          averageBatchTime: 0,
          memoryUsage: this.getMemoryUsage()
        });
      }

    } finally {
      await this.cleanupWorkers();
    }

    return results;
  }

  private async processSingleBatch<T, R>(
    batch: T[],
    batchIndex: number,
    processor: BatchProcessor<T, R>,
    errorCallback?: ErrorCallback
  ): Promise<R[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.options.retryAttempts; attempt++) {
      try {
        return await processor(batch);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.options.retryAttempts && this.options.enableRetry) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
          
          const batchError: BatchError = {
            batchIndex,
            recordIndex: -1,
            error: error.message,
            recoverable: true,
            retryCount: attempt + 1
          };

          errorCallback?.(batchError);
          this.emit('batch:retry', batchError);
        }
      }
    }

    // All retries failed
    throw lastError;
  }

  private async processBatchWithWorker<T, R>(
    batch: T[],
    batchIndex: number,
    processor: BatchProcessor<T, R>,
    errorCallback?: ErrorCallback
  ): Promise<R[]> {
    return new Promise((resolve, reject) => {
      // For simplicity, we'll process in main thread
      // In a real implementation, you'd send the batch to a worker
      this.processSingleBatch(batch, batchIndex, processor, errorCallback)
        .then(resolve)
        .catch(reject);
    });
  }

  private async createWorkerPool(count: number): Promise<void> {
    // Placeholder for worker creation
    // In a real implementation, you'd create Worker instances
    console.log(`Creating worker pool with ${count} workers`);
  }

  private async cleanupWorkers(): Promise<void> {
    for (const worker of this.workers) {
      await worker.terminate();
    }
    this.workers = [];
  }

  private async createCheckpoint(
    batchIndex: number,
    processedCount: number,
    state: any
  ): Promise<void> {
    const checkpoint: BatchCheckpoint = {
      id: `checkpoint-${Date.now()}-${batchIndex}`,
      batchIndex,
      processedCount,
      timestamp: new Date(),
      state
    };

    this.checkpoints.set(checkpoint.id, checkpoint);
    this.emit('checkpoint:created', checkpoint);
  }

  private startMemoryMonitoring(): void {
    if (this.memoryMonitor) {
      return;
    }

    this.memoryMonitor = setInterval(() => {
      const memUsage = this.getMemoryUsage();
      const memUsageMB = memUsage.heapUsed / 1024 / 1024;

      this.emit('memory:update', memUsage);

      if (memUsageMB > this.options.memoryLimit * 0.9) {
        this.emit('memory:warning', {
          current: memUsageMB,
          limit: this.options.memoryLimit,
          percentage: (memUsageMB / this.options.memoryLimit) * 100
        });
      }

      if (memUsageMB > this.options.memoryLimit) {
        this.emit('memory:limit', {
          current: memUsageMB,
          limit: this.options.memoryLimit
        });
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }, 5000); // Check every 5 seconds
  }

  private stopMemoryMonitoring(): void {
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
    }
  }

  private getMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    };
  }
}

// Worker thread code (would be in a separate file in real implementation)
if (!isMainThread && parentPort) {
  parentPort.on('message', async (data) => {
    try {
      const { batch, processor, batchIndex } = data;
      
      // Process batch
      const result = await processor(batch);
      
      parentPort!.postMessage({
        success: true,
        result,
        batchIndex
      });
    } catch (error) {
      parentPort!.postMessage({
        success: false,
        error: error.message,
        batchIndex: data.batchIndex
      });
    }
  });
}

export default BatchProcessor;