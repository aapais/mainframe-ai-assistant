/**
 * Incremental Loading Cache Implementation
 * Progressive data loading with intelligent chunking and prioritization
 */

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

/**
 * Intelligent Incremental Loading System
 *
 * Features:
 * - Progressive data loading with chunking
 * - Adaptive chunk size optimization
 * - Priority-based loading queues
 * - Intelligent caching of chunks
 * - Parallel and sequential loading strategies
 * - Real-time progress tracking
 * - Throughput optimization
 * - Error recovery and retry logic
 * - Load balancing across data sources
 */
export class IncrementalLoader<T = any> extends EventEmitter {
  private config: IncrementalLoaderConfig;
  private chunkCache: ChunkCache<T>;

  // Load management
  private activeLoads = new Map<string, LoadRequest<T>>();
  private loadQueue: LoadRequest<T>[] = [];
  private currentParallelLoads = 0;

  // Performance tracking
  private loadHistory: Array<{
    requestId: string;
    chunkId: string;
    loadTime: number;
    chunkSize: number;
    timestamp: number;
    fromCache: boolean;
  }> = [];

  // Adaptive optimization
  private optimalChunkSizes = new Map<string, number>();
  private throughputHistory: number[] = [];

  constructor(
    chunkCache: ChunkCache<T>,
    config: Partial<IncrementalLoaderConfig> = {}
  ) {
    super();

    this.config = {
      defaultChunkSize: 100,
      maxParallelLoads: 3,
      enableAdaptiveChunking: true,
      enablePrioritization: true,
      enableCaching: true,
      chunkCacheTTL: 300000, // 5 minutes
      loadTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000,
      throughputThreshold: 0.8,
      adaptiveThreshold: 0.1,
      ...config
    };

    this.chunkCache = chunkCache;
    this.startLoadProcessor();
  }

  /**
   * Start incremental loading process
   */
  async load<U extends T>(
    request: LoadRequest<U>,
    dataSource: (offset: number, limit: number) => Promise<U[]>
  ): Promise<U[]> {
    const startTime = performance.now();

    try {
      // Validate request
      this.validateLoadRequest(request);

      // Check if already loading
      if (this.activeLoads.has(request.id)) {
        throw new Error(`Load request ${request.id} is already active`);
      }

      // Add to active loads
      this.activeLoads.set(request.id, request as LoadRequest<T>);

      console.log(`Starting incremental load: ${request.id} (${request.totalSize} items)`);

      // Determine optimal chunking strategy
      const chunkingStrategy = this.determineChunkingStrategy(request);

      // Create load plan
      const loadPlan = this.createLoadPlan(request, chunkingStrategy);

      // Execute load plan
      const result = await this.executeLoadPlan(request as LoadRequest<T>, loadPlan, dataSource as any);

      // Calculate final stats
      const totalTime = performance.now() - startTime;
      const stats: LoadStats = {
        totalLoadTime: totalTime,
        averageChunkTime: totalTime / loadPlan.length,
        throughput: request.totalSize / (totalTime / 1000),
        cacheHitRate: this.calculateCacheHitRate(request.id),
        chunksFromCache: this.getChunksFromCache(request.id),
        chunksFromSource: this.getChunksFromSource(request.id),
        errorCount: 0
      };

      console.log(`Incremental load completed: ${request.id} in ${Math.round(totalTime)}ms`);

      // Call completion callback
      if (request.onComplete) {
        request.onComplete(result, stats);
      }

      this.emit('load-complete', { requestId: request.id, stats });

      return result;

    } catch (error) {
      console.error(`Incremental load failed: ${request.id}`, error);

      if (request.onError) {
        request.onError(error as Error);
      }

      this.emit('load-error', { requestId: request.id, error });
      throw error;

    } finally {
      this.activeLoads.delete(request.id);
    }
  }

  /**
   * Preload data chunks for better performance
   */
  async preload<U extends T>(
    requestId: string,
    query: string,
    chunkIds: string[],
    dataSource: (chunkId: string) => Promise<U[]>
  ): Promise<number> {
    let preloadedCount = 0;

    console.log(`Preloading ${chunkIds.length} chunks for ${requestId}`);

    const preloadPromises = chunkIds.map(async (chunkId) => {
      try {
        // Check if already cached
        const cacheKey = this.generateCacheKey(requestId, chunkId);

        if (this.config.enableCaching && this.chunkCache.get(cacheKey)) {
          return; // Already cached
        }

        // Load chunk
        const data = await dataSource(chunkId);

        // Create chunk object
        const chunk: LoadChunk<U> = {
          id: chunkId,
          data,
          size: data.length,
          priority: 1,
          timestamp: Date.now(),
          estimatedLoadTime: 100
        };

        // Cache the chunk
        if (this.config.enableCaching) {
          this.chunkCache.set(cacheKey, chunk as LoadChunk<T>, this.config.chunkCacheTTL);
        }

        preloadedCount++;
        this.emit('chunk-preloaded', { requestId, chunkId, size: data.length });

      } catch (error) {
        console.error(`Preload failed for chunk ${chunkId}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);

    console.log(`Preloaded ${preloadedCount}/${chunkIds.length} chunks`);
    return preloadedCount;
  }

  /**
   * Cancel an active load request
   */
  cancelLoad(requestId: string): boolean {
    if (this.activeLoads.has(requestId)) {
      this.activeLoads.delete(requestId);
      this.emit('load-cancelled', { requestId });
      return true;
    }
    return false;
  }

  /**
   * Get current load progress for a request
   */
  getLoadProgress(requestId: string): LoadProgress | null {
    const request = this.activeLoads.get(requestId);
    if (!request) return null;

    const totalChunks = Math.ceil(request.totalSize / request.chunkSize);
    const loadedChunks = this.getLoadedChunkCount(requestId);
    const loadedSize = loadedChunks * request.chunkSize;

    const progress: LoadProgress = {
      loadedChunks,
      totalChunks,
      loadedSize: Math.min(loadedSize, request.totalSize),
      totalSize: request.totalSize,
      percentage: Math.min(100, (loadedSize / request.totalSize) * 100),
      estimatedTimeRemaining: this.estimateTimeRemaining(request, loadedChunks),
      currentThroughput: this.getCurrentThroughput()
    };

    return progress;
  }

  /**
   * Optimize chunk sizes based on performance history
   */
  optimizeChunkSizes(): void {
    if (!this.config.enableAdaptiveChunking) return;

    console.log('Optimizing chunk sizes based on performance data...');

    // Analyze recent load history
    const recentLoads = this.loadHistory
      .filter(load => Date.now() - load.timestamp < 60 * 60 * 1000) // Last hour
      .filter(load => !load.fromCache); // Only actual loads

    if (recentLoads.length < 10) return;

    // Group by similar load patterns
    const patternGroups = this.groupLoadsByPattern(recentLoads);

    for (const [pattern, loads] of patternGroups) {
      // Calculate optimal chunk size for this pattern
      const optimalSize = this.calculateOptimalChunkSize(loads);

      if (optimalSize !== this.optimalChunkSizes.get(pattern)) {
        this.optimalChunkSizes.set(pattern, optimalSize);
        console.log(`Updated optimal chunk size for pattern ${pattern}: ${optimalSize}`);
      }
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    activeLoads: number;
    queuedLoads: number;
    cacheSize: number;
    averageLoadTime: number;
    averageThroughput: number;
    cacheHitRate: number;
  } {
    const recentLoads = this.loadHistory
      .filter(load => Date.now() - load.timestamp < 60 * 60 * 1000);

    const averageLoadTime = recentLoads.length > 0
      ? recentLoads.reduce((sum, load) => sum + load.loadTime, 0) / recentLoads.length
      : 0;

    const cacheHits = recentLoads.filter(load => load.fromCache).length;
    const cacheHitRate = recentLoads.length > 0 ? cacheHits / recentLoads.length : 0;

    const averageThroughput = this.throughputHistory.length > 0
      ? this.throughputHistory.reduce((sum, t) => sum + t, 0) / this.throughputHistory.length
      : 0;

    return {
      activeLoads: this.activeLoads.size,
      queuedLoads: this.loadQueue.length,
      cacheSize: this.chunkCache.size,
      averageLoadTime,
      averageThroughput,
      cacheHitRate
    };
  }

  // Private Implementation

  private validateLoadRequest(request: LoadRequest<T>): void {
    if (!request.id) throw new Error('Load request must have an ID');
    if (!request.query) throw new Error('Load request must have a query');
    if (request.totalSize <= 0) throw new Error('Total size must be positive');
    if (request.chunkSize <= 0) throw new Error('Chunk size must be positive');
  }

  private determineChunkingStrategy(request: LoadRequest<T>): {
    chunkSize: number;
    strategy: 'sequential' | 'parallel' | 'adaptive';
  } {
    let chunkSize = request.chunkSize;

    // Use adaptive chunk size if available
    if (this.config.enableAdaptiveChunking) {
      const pattern = this.getLoadPattern(request);
      const optimalSize = this.optimalChunkSizes.get(pattern);

      if (optimalSize) {
        chunkSize = optimalSize;
      }
    }

    // Adjust strategy based on request size and priority
    let strategy = request.loadStrategy;

    if (strategy === 'adaptive') {
      if (request.totalSize > 1000 && request.priority === 'high') {
        strategy = 'parallel';
      } else if (request.totalSize < 100) {
        strategy = 'sequential';
      } else {
        strategy = 'parallel';
      }
    }

    return { chunkSize, strategy };
  }

  private createLoadPlan(
    request: LoadRequest<T>,
    chunkingStrategy: { chunkSize: number; strategy: string }
  ): Array<{ offset: number; limit: number; priority: number }> {
    const plan: Array<{ offset: number; limit: number; priority: number }> = [];
    const { chunkSize } = chunkingStrategy;

    for (let offset = 0; offset < request.totalSize; offset += chunkSize) {
      const limit = Math.min(chunkSize, request.totalSize - offset);

      // Calculate priority based on position and request priority
      let priority = 1;

      if (request.priority === 'critical') priority = 4;
      else if (request.priority === 'high') priority = 3;
      else if (request.priority === 'medium') priority = 2;

      // Boost priority for first few chunks (progressive loading)
      if (offset < chunkSize * 3) {
        priority += 1;
      }

      plan.push({ offset, limit, priority });
    }

    // Sort by priority if prioritization is enabled
    if (this.config.enablePrioritization) {
      plan.sort((a, b) => b.priority - a.priority);
    }

    return plan;
  }

  private async executeLoadPlan(
    request: LoadRequest<T>,
    plan: Array<{ offset: number; limit: number; priority: number }>,
    dataSource: (offset: number, limit: number) => Promise<T[]>
  ): Promise<T[]> {
    const results: T[] = [];
    const strategy = request.loadStrategy;

    if (strategy === 'sequential' || strategy === 'adaptive') {
      // Sequential loading
      for (const chunk of plan) {
        const chunkData = await this.loadChunk(request, chunk.offset, chunk.limit, dataSource);
        results.splice(chunk.offset, chunk.limit, ...chunkData);

        // Update progress
        const progress = this.calculateProgress(request, results.length);
        if (request.onChunkLoaded) {
          request.onChunkLoaded({
            id: `${chunk.offset}-${chunk.limit}`,
            data: chunkData,
            size: chunkData.length,
            priority: chunk.priority,
            timestamp: Date.now(),
            estimatedLoadTime: 0
          }, progress);
        }
      }
    } else {
      // Parallel loading
      const parallelChunks = Math.min(request.maxParallelChunks, this.config.maxParallelLoads);
      const chunkPromises: Promise<{ data: T[]; offset: number; limit: number }>[] = [];

      for (let i = 0; i < plan.length; i += parallelChunks) {
        const batch = plan.slice(i, i + parallelChunks);

        const batchPromises = batch.map(async (chunk) => {
          const data = await this.loadChunk(request, chunk.offset, chunk.limit, dataSource);
          return { data, offset: chunk.offset, limit: chunk.limit };
        });

        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(result => {
          results.splice(result.offset, result.limit, ...result.data);

          // Update progress
          const progress = this.calculateProgress(request, results.length);
          if (request.onChunkLoaded) {
            request.onChunkLoaded({
              id: `${result.offset}-${result.limit}`,
              data: result.data,
              size: result.data.length,
              priority: 1,
              timestamp: Date.now(),
              estimatedLoadTime: 0
            }, progress);
          }
        });
      }
    }

    return results.filter(item => item !== undefined);
  }

  private async loadChunk(
    request: LoadRequest<T>,
    offset: number,
    limit: number,
    dataSource: (offset: number, limit: number) => Promise<T[]>
  ): Promise<T[]> {
    const startTime = performance.now();
    const chunkId = `${offset}-${limit}`;
    const cacheKey = this.generateCacheKey(request.id, chunkId);

    try {
      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.chunkCache.get(cacheKey);

        if (cached && !this.isChunkExpired(cached)) {
          this.recordLoadHistory(request.id, chunkId, performance.now() - startTime, cached.size, true);
          return cached.data;
        }
      }

      // Load from data source
      const data = await this.executeWithTimeout(
        () => dataSource(offset, limit),
        this.config.loadTimeout
      );

      const loadTime = performance.now() - startTime;

      // Cache the result
      if (this.config.enableCaching) {
        const chunk: LoadChunk<T> = {
          id: chunkId,
          data,
          size: data.length,
          priority: 1,
          timestamp: Date.now(),
          estimatedLoadTime: loadTime
        };

        this.chunkCache.set(cacheKey, chunk, this.config.chunkCacheTTL);
      }

      this.recordLoadHistory(request.id, chunkId, loadTime, data.length, false);
      this.updateThroughput(data.length, loadTime);

      return data;

    } catch (error) {
      console.error(`Chunk load failed: ${chunkId}`, error);

      // Retry logic
      if (this.config.retryAttempts > 0) {
        return this.retryChunkLoad(request, offset, limit, dataSource, 1);
      }

      throw error;
    }
  }

  private async retryChunkLoad(
    request: LoadRequest<T>,
    offset: number,
    limit: number,
    dataSource: (offset: number, limit: number) => Promise<T[]>,
    attempt: number
  ): Promise<T[]> {
    if (attempt > this.config.retryAttempts) {
      throw new Error(`Chunk load failed after ${this.config.retryAttempts} attempts`);
    }

    console.log(`Retrying chunk load (attempt ${attempt}): ${offset}-${limit}`);

    await this.sleep(this.config.retryDelay * attempt);

    try {
      return await this.loadChunk(request, offset, limit, dataSource);
    } catch (error) {
      return this.retryChunkLoad(request, offset, limit, dataSource, attempt + 1);
    }
  }

  private calculateProgress(request: LoadRequest<T>, loadedSize: number): LoadProgress {
    const totalChunks = Math.ceil(request.totalSize / request.chunkSize);
    const loadedChunks = Math.ceil(loadedSize / request.chunkSize);

    return {
      loadedChunks,
      totalChunks,
      loadedSize,
      totalSize: request.totalSize,
      percentage: (loadedSize / request.totalSize) * 100,
      estimatedTimeRemaining: this.estimateTimeRemaining(request, loadedChunks),
      currentThroughput: this.getCurrentThroughput()
    };
  }

  private generateCacheKey(requestId: string, chunkId: string): string {
    return `${requestId}:${chunkId}`;
  }

  private isChunkExpired(chunk: LoadChunk<T>): boolean {
    return Date.now() - chunk.timestamp > this.config.chunkCacheTTL;
  }

  private recordLoadHistory(
    requestId: string,
    chunkId: string,
    loadTime: number,
    chunkSize: number,
    fromCache: boolean
  ): void {
    this.loadHistory.push({
      requestId,
      chunkId,
      loadTime,
      chunkSize,
      timestamp: Date.now(),
      fromCache
    });

    // Keep only recent history
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.loadHistory = this.loadHistory.filter(h => h.timestamp > cutoff);
  }

  private updateThroughput(chunkSize: number, loadTime: number): void {
    const throughput = chunkSize / (loadTime / 1000); // items per second
    this.throughputHistory.push(throughput);

    // Keep only recent throughput data
    if (this.throughputHistory.length > 100) {
      this.throughputHistory = this.throughputHistory.slice(-100);
    }
  }

  private getCurrentThroughput(): number {
    if (this.throughputHistory.length === 0) return 0;

    return this.throughputHistory.reduce((sum, t) => sum + t, 0) / this.throughputHistory.length;
  }

  private estimateTimeRemaining(request: LoadRequest<T>, loadedChunks: number): number {
    const totalChunks = Math.ceil(request.totalSize / request.chunkSize);
    const remainingChunks = totalChunks - loadedChunks;

    if (remainingChunks <= 0) return 0;

    const averageChunkTime = this.getAverageChunkTime(request.id);
    return remainingChunks * averageChunkTime;
  }

  private getAverageChunkTime(requestId: string): number {
    const requestLoads = this.loadHistory
      .filter(h => h.requestId === requestId && !h.fromCache);

    if (requestLoads.length === 0) return 1000; // Default 1 second

    return requestLoads.reduce((sum, h) => sum + h.loadTime, 0) / requestLoads.length;
  }

  private getLoadedChunkCount(requestId: string): number {
    return this.loadHistory.filter(h => h.requestId === requestId).length;
  }

  private calculateCacheHitRate(requestId: string): number {
    const requestLoads = this.loadHistory.filter(h => h.requestId === requestId);
    if (requestLoads.length === 0) return 0;

    const cacheHits = requestLoads.filter(h => h.fromCache).length;
    return cacheHits / requestLoads.length;
  }

  private getChunksFromCache(requestId: string): number {
    return this.loadHistory.filter(h => h.requestId === requestId && h.fromCache).length;
  }

  private getChunksFromSource(requestId: string): number {
    return this.loadHistory.filter(h => h.requestId === requestId && !h.fromCache).length;
  }

  private getLoadPattern(request: LoadRequest<T>): string {
    // Create a pattern key based on query characteristics
    const queryTerms = request.query.split(' ').length;
    const sizeCategory = request.totalSize < 100 ? 'small' : request.totalSize < 1000 ? 'medium' : 'large';
    const priorityLevel = request.priority;

    return `${sizeCategory}-${priorityLevel}-${queryTerms}terms`;
  }

  private groupLoadsByPattern(loads: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    loads.forEach(load => {
      const pattern = `${Math.floor(load.chunkSize / 50) * 50}`; // Group by chunk size ranges

      if (!groups.has(pattern)) {
        groups.set(pattern, []);
      }

      groups.get(pattern)!.push(load);
    });

    return groups;
  }

  private calculateOptimalChunkSize(loads: any[]): number {
    // Analyze performance vs chunk size
    const performanceBySize = new Map<number, number[]>();

    loads.forEach(load => {
      const sizeKey = Math.floor(load.chunkSize / 10) * 10; // Group by 10s
      const performance = load.chunkSize / load.loadTime; // throughput

      if (!performanceBySize.has(sizeKey)) {
        performanceBySize.set(sizeKey, []);
      }

      performanceBySize.get(sizeKey)!.push(performance);
    });

    // Find size with best average performance
    let bestSize = this.config.defaultChunkSize;
    let bestPerformance = 0;

    for (const [size, performances] of performanceBySize) {
      const avgPerformance = performances.reduce((sum, p) => sum + p, 0) / performances.length;

      if (avgPerformance > bestPerformance) {
        bestPerformance = avgPerformance;
        bestSize = size;
      }
    }

    return bestSize;
  }

  private async executeWithTimeout<U>(
    operation: () => Promise<U>,
    timeout: number
  ): Promise<U> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startLoadProcessor(): void {
    // Process load queue periodically
    setInterval(() => {
      this.processLoadQueue();
    }, 100);

    // Optimize chunk sizes periodically
    setInterval(() => {
      this.optimizeChunkSizes();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private processLoadQueue(): void {
    if (this.loadQueue.length === 0 || this.currentParallelLoads >= this.config.maxParallelLoads) {
      return;
    }

    // Sort queue by priority
    this.loadQueue.sort((a, b) => {
      const priorityScore = { low: 1, medium: 2, high: 3, critical: 4 };
      return priorityScore[b.priority] - priorityScore[a.priority];
    });

    // Process highest priority request
    const nextRequest = this.loadQueue.shift();
    if (nextRequest) {
      this.currentParallelLoads++;
      // In practice, this would trigger the load operation
      this.emit('load-started', { requestId: nextRequest.id });
    }
  }
}

export default IncrementalLoader;