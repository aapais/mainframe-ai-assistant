import { EventEmitter } from 'events';
export interface LoadChunk<T> {
  id: string;
  data: T[];
  size: number;
  priority: number;
  timestamp: number;
  dependsOn?: string[];
  estimatedLoadTime: number;
  actualLoadTime?: number;
}
export interface LoadRequest<T> {
  id: string;
  query: string;
  totalSize: number;
  chunkSize: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  loadStrategy: 'sequential' | 'parallel' | 'adaptive';
  maxParallelChunks: number;
  userContext?: string;
  onChunkLoaded?: (chunk: LoadChunk<T>, progress: LoadProgress) => void;
  onComplete?: (data: T[], stats: LoadStats) => void;
  onError?: (error: Error, chunkId?: string) => void;
}
export interface LoadProgress {
  loadedChunks: number;
  totalChunks: number;
  loadedSize: number;
  totalSize: number;
  percentage: number;
  estimatedTimeRemaining: number;
  currentThroughput: number;
}
export interface LoadStats {
  totalLoadTime: number;
  averageChunkTime: number;
  throughput: number;
  cacheHitRate: number;
  chunksFromCache: number;
  chunksFromSource: number;
  errorCount: number;
}
export interface IncrementalLoaderConfig {
  defaultChunkSize: number;
  maxParallelLoads: number;
  enableAdaptiveChunking: boolean;
  enablePrioritization: boolean;
  enableCaching: boolean;
  chunkCacheTTL: number;
  loadTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  throughputThreshold: number;
  adaptiveThreshold: number;
}
export interface ChunkCache<T> {
  get(key: string): LoadChunk<T> | null;
  set(key: string, chunk: LoadChunk<T>, ttl?: number): void;
  delete(key: string): boolean;
  clear(): void;
  size: number;
}
export declare class IncrementalLoader<T = any> extends EventEmitter {
  private config;
  private chunkCache;
  private activeLoads;
  private loadQueue;
  private currentParallelLoads;
  private loadHistory;
  private optimalChunkSizes;
  private throughputHistory;
  constructor(chunkCache: ChunkCache<T>, config?: Partial<IncrementalLoaderConfig>);
  load<U extends T>(
    request: LoadRequest<U>,
    dataSource: (offset: number, limit: number) => Promise<U[]>
  ): Promise<U[]>;
  preload<U extends T>(
    requestId: string,
    query: string,
    chunkIds: string[],
    dataSource: (chunkId: string) => Promise<U[]>
  ): Promise<number>;
  cancelLoad(requestId: string): boolean;
  getLoadProgress(requestId: string): LoadProgress | null;
  optimizeChunkSizes(): void;
  getStats(): {
    activeLoads: number;
    queuedLoads: number;
    cacheSize: number;
    averageLoadTime: number;
    averageThroughput: number;
    cacheHitRate: number;
  };
  private validateLoadRequest;
  private determineChunkingStrategy;
  private createLoadPlan;
  private executeLoadPlan;
  private loadChunk;
  private retryChunkLoad;
  private calculateProgress;
  private generateCacheKey;
  private isChunkExpired;
  private recordLoadHistory;
  private updateThroughput;
  private getCurrentThroughput;
  private estimateTimeRemaining;
  private getAverageChunkTime;
  private getLoadedChunkCount;
  private calculateCacheHitRate;
  private getChunksFromCache;
  private getChunksFromSource;
  private getLoadPattern;
  private groupLoadsByPattern;
  private calculateOptimalChunkSize;
  private executeWithTimeout;
  private sleep;
  private startLoadProcessor;
  private processLoadQueue;
}
export default IncrementalLoader;
//# sourceMappingURL=IncrementalLoader.d.ts.map
