import { EventEmitter } from 'events';
export interface BatchOptions {
  batchSize?: number;
  maxConcurrency?: number;
  enableProgress?: boolean;
  enableRetry?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  memoryLimit?: number;
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
export declare class BatchProcessor extends EventEmitter {
  private options;
  private workers;
  private checkpoints;
  private isProcessing;
  private memoryMonitor;
  constructor(options?: BatchOptions);
  processBatch<T, R>(
    data: T[],
    processor: BatchProcessor<T, R>,
    progressCallback?: ProgressCallback,
    errorCallback?: ErrorCallback
  ): Promise<BatchResult<R>>;
  processStream<T, R>(
    dataGenerator: AsyncGenerator<T[], void, unknown>,
    processor: BatchProcessor<T, R>,
    progressCallback?: ProgressCallback,
    errorCallback?: ErrorCallback
  ): Promise<AsyncGenerator<R[], void, unknown>>;
  resumeFromCheckpoint<T, R>(
    checkpointId: string,
    data: T[],
    processor: BatchProcessor<T, R>,
    progressCallback?: ProgressCallback,
    errorCallback?: ErrorCallback
  ): Promise<BatchResult<R>>;
  cancel(): Promise<void>;
  getStatistics(): {
    isProcessing: boolean;
    activeWorkers: number;
    checkpointCount: number;
    memoryUsage: MemoryUsage;
  };
  private createBatches;
  private processSequentially;
  private processWithWorkers;
  private processSingleBatch;
  private processBatchWithWorker;
  private createWorkerPool;
  private cleanupWorkers;
  private createCheckpoint;
  private startMemoryMonitoring;
  private stopMemoryMonitoring;
  private getMemoryUsage;
}
export default BatchProcessor;
//# sourceMappingURL=BatchProcessor.d.ts.map
