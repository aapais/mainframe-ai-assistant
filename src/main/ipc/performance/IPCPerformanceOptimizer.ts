/**
 * IPC Performance Optimizer
 * 
 * Advanced performance optimization for IPC operations including
 * intelligent batching, adaptive caching, and resource management.
 */

import { EventEmitter } from 'events';
import { AppError } from '../../../core/errors/AppError';
import { 
  IPCChannel,
  ChannelMetrics,
  RealTimeMetrics,
  PerformanceMetrics,
  BaseIPCRequest,
  BaseIPCResponse
} from '../../../types/ipc';

// ===========================
// Performance Configuration
// ===========================

interface PerformanceConfig {
  // Batching configuration
  batchConfig: {
    enabled: boolean;
    maxBatchSize: number;
    maxDelayMs: number;
    adaptiveBatching: boolean;
    batchSizeThresholds: {
      low: number;
      medium: number;
      high: number;
    };
  };
  
  // Caching configuration
  cacheConfig: {
    enabled: boolean;
    maxMemoryUsage: number; // in bytes
    ttlMs: number;
    adaptiveTTL: boolean;
    compressionEnabled: boolean;
    compressionThreshold: number;
  };
  
  // Resource management
  resourceConfig: {
    maxConcurrentRequests: number;
    requestTimeoutMs: number;
    memoryThresholdMB: number;
    cpuThresholdPercent: number;
    enableResourceMonitoring: boolean;
  };
  
  // Optimization strategy
  optimizationConfig: {
    enablePredictiveOptimization: boolean;
    learningEnabled: boolean;
    optimizationInterval: number;
    performanceTargets: {
      responseTimeMs: number;
      throughputPerSecond: number;
      errorRatePercent: number;
    };
  };
}

interface OptimizationStrategy {
  channel: string;
  currentStrategy: 'batch' | 'stream' | 'cache' | 'direct';
  performanceScore: number;
  lastOptimized: number;
  adjustments: OptimizationAdjustment[];
}

interface OptimizationAdjustment {
  timestamp: number;
  parameter: string;
  oldValue: any;
  newValue: any;
  reason: string;
  impact: 'positive' | 'negative' | 'neutral';
  impactScore: number;
}

// ===========================
// Adaptive Batch Manager
// ===========================

class AdaptiveBatchManager extends EventEmitter {
  private batchQueues = new Map<string, BatchQueue>();
  private batchMetrics = new Map<string, BatchMetrics>();
  
  constructor(private config: PerformanceConfig) {
    super();
    this.startBatchOptimization();
  }

  async addToBatch<T>(
    channel: string, 
    request: BaseIPCRequest,
    handler: Function
  ): Promise<T> {
    const queue = this.getOrCreateQueue(channel);
    
    return new Promise((resolve, reject) => {
      queue.add({
        request,
        handler,
        resolve,
        reject,
        timestamp: Date.now()
      });
    });
  }

  private getOrCreateQueue(channel: string): BatchQueue {
    if (!this.batchQueues.has(channel)) {
      const queue = new BatchQueue(channel, this.config.batchConfig, this);
      this.batchQueues.set(channel, queue);
    }
    return this.batchQueues.get(channel)!;
  }

  private startBatchOptimization(): void {
    setInterval(() => {
      this.optimizeBatchSizes();
    }, 30000); // Every 30 seconds
  }

  private optimizeBatchSizes(): void {
    for (const [channel, queue] of this.batchQueues.entries()) {
      const metrics = this.batchMetrics.get(channel);
      if (!metrics) continue;

      const currentPerformance = this.calculateBatchPerformance(metrics);
      const optimization = this.suggestBatchOptimization(currentPerformance);
      
      if (optimization.shouldAdjust) {
        queue.updateConfig(optimization.newConfig);
        
        this.emit('batch-optimized', {
          channel,
          optimization,
          timestamp: Date.now()
        });
      }
    }
  }

  private calculateBatchPerformance(metrics: BatchMetrics): BatchPerformance {
    return {
      throughput: metrics.totalProcessed / (metrics.totalTimeMs / 1000),
      averageLatency: metrics.averageProcessingTimeMs,
      errorRate: metrics.errorCount / metrics.totalBatches,
      efficiency: metrics.averageBatchSize / metrics.maxBatchSize,
      memoryUsage: metrics.memoryUsageBytes
    };
  }

  private suggestBatchOptimization(performance: BatchPerformance): BatchOptimization {
    const suggestions: string[] = [];
    let newConfig = { ...this.config.batchConfig };
    let shouldAdjust = false;

    // Optimize batch size based on throughput and latency
    if (performance.throughput < this.config.optimizationConfig.performanceTargets.throughputPerSecond) {
      if (performance.averageLatency < this.config.optimizationConfig.performanceTargets.responseTimeMs) {
        // Low throughput but good latency - increase batch size
        newConfig.maxBatchSize = Math.min(newConfig.maxBatchSize * 1.2, 100);
        suggestions.push('Increased batch size to improve throughput');
        shouldAdjust = true;
      } else {
        // Low throughput and poor latency - decrease batch size
        newConfig.maxBatchSize = Math.max(newConfig.maxBatchSize * 0.8, 5);
        suggestions.push('Decreased batch size to improve latency');
        shouldAdjust = true;
      }
    }

    // Optimize delay based on efficiency
    if (performance.efficiency < 0.7) {
      // Low efficiency - increase delay to allow larger batches
      newConfig.maxDelayMs = Math.min(newConfig.maxDelayMs * 1.1, 1000);
      suggestions.push('Increased batch delay to improve efficiency');
      shouldAdjust = true;
    }

    return {
      shouldAdjust,
      newConfig,
      suggestions,
      expectedImpact: shouldAdjust ? this.predictOptimizationImpact(performance, newConfig) : 0
    };
  }

  private predictOptimizationImpact(current: BatchPerformance, newConfig: any): number {
    // Simplified prediction model
    // In reality, this would use ML or more sophisticated modeling
    const batchSizeImpact = (newConfig.maxBatchSize / this.config.batchConfig.maxBatchSize - 1) * 0.3;
    const delayImpact = (newConfig.maxDelayMs / this.config.batchConfig.maxDelayMs - 1) * 0.1;
    
    return (batchSizeImpact + delayImpact) * 100; // Convert to percentage
  }

  recordBatchMetrics(channel: string, metrics: Partial<BatchMetrics>): void {
    const existing = this.batchMetrics.get(channel) || this.createEmptyBatchMetrics();
    const updated = { ...existing, ...metrics, lastUpdated: Date.now() };
    this.batchMetrics.set(channel, updated);
  }

  private createEmptyBatchMetrics(): BatchMetrics {
    return {
      totalBatches: 0,
      totalProcessed: 0,
      totalTimeMs: 0,
      averageProcessingTimeMs: 0,
      averageBatchSize: 0,
      maxBatchSize: 0,
      errorCount: 0,
      memoryUsageBytes: 0,
      lastUpdated: Date.now()
    };
  }

  getBatchMetrics(channel?: string): Map<string, BatchMetrics> | BatchMetrics | null {
    if (channel) {
      return this.batchMetrics.get(channel) || null;
    }
    return new Map(this.batchMetrics);
  }
}

// ===========================
// Smart Cache Manager
// ===========================

class SmartCacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private cacheMetrics = new Map<string, CacheChannelMetrics>();
  private totalMemoryUsage = 0;
  
  constructor(private config: PerformanceConfig) {
    this.startCacheOptimization();
    this.startMemoryMonitoring();
  }

  async get(key: string, channel: string): Promise<any | null> {
    const entry = this.memoryCache.get(key);
    
    if (!entry) {
      this.recordCacheMiss(channel);
      return null;
    }
    
    // Check if expired
    if (this.isExpired(entry)) {
      this.memoryCache.delete(key);
      this.updateMemoryUsage(-entry.size);
      this.recordCacheMiss(channel);
      return null;
    }
    
    // Update access time and hit count
    entry.lastAccessed = Date.now();
    entry.hitCount++;
    
    this.recordCacheHit(channel);
    return entry.compressed ? this.decompress(entry.data) : entry.data;
  }

  async set(key: string, value: any, channel: string, customTTL?: number): Promise<void> {
    const ttl = customTTL || this.calculateAdaptiveTTL(channel);
    const size = this.calculateSize(value);
    
    // Check memory limits
    if (this.totalMemoryUsage + size > this.config.cacheConfig.maxMemoryUsage) {
      await this.evictLeastUsed();
    }
    
    // Compress if needed
    let data = value;
    let compressed = false;
    
    if (this.config.cacheConfig.compressionEnabled && 
        size > this.config.cacheConfig.compressionThreshold) {
      data = await this.compress(value);
      compressed = true;
    }
    
    const entry: CacheEntry = {
      data,
      compressed,
      size: compressed ? this.calculateSize(data) : size,
      originalSize: size,
      ttl,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      hitCount: 0,
      channel
    };
    
    // Remove old entry if exists
    const oldEntry = this.memoryCache.get(key);
    if (oldEntry) {
      this.updateMemoryUsage(-oldEntry.size);
    }
    
    this.memoryCache.set(key, entry);
    this.updateMemoryUsage(entry.size);
  }

  private calculateAdaptiveTTL(channel: string): number {
    if (!this.config.cacheConfig.adaptiveTTL) {
      return this.config.cacheConfig.ttlMs;
    }
    
    const metrics = this.cacheMetrics.get(channel);
    if (!metrics) {
      return this.config.cacheConfig.ttlMs;
    }
    
    // Adaptive TTL based on hit rate and access patterns
    const baseTTL = this.config.cacheConfig.ttlMs;
    const hitRateMultiplier = metrics.hitRate / 100; // 0-1
    const accessFrequencyMultiplier = Math.min(2, metrics.accessFrequency / 10);
    
    return Math.floor(baseTTL * (0.5 + hitRateMultiplier * accessFrequencyMultiplier));
  }

  private async evictLeastUsed(): Promise<void> {
    const entries = Array.from(this.memoryCache.entries())
      .sort(([, a], [, b]) => {
        // Sort by access frequency and recency
        const scoreA = a.hitCount / (Date.now() - a.lastAccessed + 1);
        const scoreB = b.hitCount / (Date.now() - b.lastAccessed + 1);
        return scoreA - scoreB;
      });
    
    // Evict 25% of entries or until under memory limit
    const evictCount = Math.max(1, Math.floor(entries.length * 0.25));
    let evicted = 0;
    
    for (const [key, entry] of entries) {
      if (evicted >= evictCount && 
          this.totalMemoryUsage <= this.config.cacheConfig.maxMemoryUsage * 0.8) {
        break;
      }
      
      this.memoryCache.delete(key);
      this.updateMemoryUsage(-entry.size);
      evicted++;
    }
  }

  private recordCacheHit(channel: string): void {
    this.updateCacheMetrics(channel, { hits: 1 });
  }

  private recordCacheMiss(channel: string): void {
    this.updateCacheMetrics(channel, { misses: 1 });
  }

  private updateCacheMetrics(channel: string, updates: Partial<CacheChannelMetrics>): void {
    const existing = this.cacheMetrics.get(channel) || this.createEmptyCacheMetrics();
    
    const updated = {
      ...existing,
      hits: existing.hits + (updates.hits || 0),
      misses: existing.misses + (updates.misses || 0),
      lastUpdated: Date.now()
    };
    
    // Recalculate derived metrics
    const total = updated.hits + updated.misses;
    updated.hitRate = total > 0 ? (updated.hits / total) * 100 : 0;
    
    this.cacheMetrics.set(channel, updated);
  }

  private createEmptyCacheMetrics(): CacheChannelMetrics {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      accessFrequency: 0,
      averageItemSize: 0,
      lastUpdated: Date.now()
    };
  }

  private startCacheOptimization(): void {
    setInterval(() => {
      this.optimizeCacheStrategies();
    }, 60000); // Every minute
  }

  private optimizeCacheStrategies(): void {
    for (const [channel, metrics] of this.cacheMetrics.entries()) {
      if (metrics.hitRate < 30) {
        // Low hit rate - reduce TTL or disable caching for this channel
        console.log(`Low cache hit rate for ${channel}: ${metrics.hitRate.toFixed(1)}%`);
      }
    }
  }

  private startMemoryMonitoring(): void {
    setInterval(() => {
      if (this.totalMemoryUsage > this.config.cacheConfig.maxMemoryUsage * 0.9) {
        this.evictLeastUsed();
      }
    }, 10000); // Every 10 seconds
  }

  private updateMemoryUsage(delta: number): void {
    this.totalMemoryUsage = Math.max(0, this.totalMemoryUsage + delta);
  }

  private calculateSize(value: any): number {
    return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.createdAt > entry.ttl;
  }

  private async compress(value: any): Promise<string> {
    // Simplified compression - in reality, use a proper compression library
    return JSON.stringify(value);
  }

  private async decompress(value: string): Promise<any> {
    return JSON.parse(value);
  }

  getCacheMetrics(): {
    totalMemoryUsage: number;
    totalEntries: number;
    channelMetrics: Map<string, CacheChannelMetrics>;
  } {
    return {
      totalMemoryUsage: this.totalMemoryUsage,
      totalEntries: this.memoryCache.size,
      channelMetrics: new Map(this.cacheMetrics)
    };
  }

  clearCache(channel?: string): void {
    if (channel) {
      const keysToDelete = Array.from(this.memoryCache.entries())
        .filter(([, entry]) => entry.channel === channel)
        .map(([key]) => key);
      
      for (const key of keysToDelete) {
        const entry = this.memoryCache.get(key);
        if (entry) {
          this.updateMemoryUsage(-entry.size);
          this.memoryCache.delete(key);
        }
      }
    } else {
      this.memoryCache.clear();
      this.totalMemoryUsage = 0;
    }
  }
}

// ===========================
// Resource Monitor
// ===========================

class ResourceMonitor {
  private currentMetrics: SystemResourceMetrics;
  private resourceHistory: SystemResourceMetrics[] = [];
  
  constructor(private config: PerformanceConfig) {
    this.currentMetrics = this.createEmptyResourceMetrics();
    
    if (config.resourceConfig.enableResourceMonitoring) {
      this.startResourceMonitoring();
    }
  }

  private startResourceMonitoring(): void {
    setInterval(() => {
      this.updateResourceMetrics();
      this.checkResourceThresholds();
    }, 1000); // Every second
  }

  private updateResourceMetrics(): void {
    const memoryUsage = process.memoryUsage();
    
    this.currentMetrics = {
      timestamp: Date.now(),
      memoryUsageMB: memoryUsage.heapUsed / 1024 / 1024,
      memoryTotalMB: memoryUsage.heapTotal / 1024 / 1024,
      cpuUsagePercent: this.getCPUUsage(),
      activeRequests: this.getActiveRequestCount(),
      uptime: process.uptime()
    };
    
    // Keep last 300 entries (5 minutes at 1s intervals)
    this.resourceHistory.push(this.currentMetrics);
    if (this.resourceHistory.length > 300) {
      this.resourceHistory.shift();
    }
  }

  private getCPUUsage(): number {
    // Simplified CPU usage calculation
    // In reality, you'd use a proper CPU monitoring library
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 1000000; // Convert to percentage
  }

  private getActiveRequestCount(): number {
    // This would integrate with your request tracking system
    return 0; // Placeholder
  }

  private checkResourceThresholds(): void {
    const { memoryThresholdMB, cpuThresholdPercent } = this.config.resourceConfig;
    
    if (this.currentMetrics.memoryUsageMB > memoryThresholdMB) {
      console.warn(`Memory usage high: ${this.currentMetrics.memoryUsageMB.toFixed(1)}MB`);
    }
    
    if (this.currentMetrics.cpuUsagePercent > cpuThresholdPercent) {
      console.warn(`CPU usage high: ${this.currentMetrics.cpuUsagePercent.toFixed(1)}%`);
    }
  }

  private createEmptyResourceMetrics(): SystemResourceMetrics {
    return {
      timestamp: Date.now(),
      memoryUsageMB: 0,
      memoryTotalMB: 0,
      cpuUsagePercent: 0,
      activeRequests: 0,
      uptime: 0
    };
  }

  getCurrentMetrics(): SystemResourceMetrics {
    return { ...this.currentMetrics };
  }

  getResourceHistory(durationMs?: number): SystemResourceMetrics[] {
    if (!durationMs) {
      return [...this.resourceHistory];
    }
    
    const cutoff = Date.now() - durationMs;
    return this.resourceHistory.filter(m => m.timestamp > cutoff);
  }

  isResourceConstrained(): boolean {
    const { memoryThresholdMB, cpuThresholdPercent } = this.config.resourceConfig;
    
    return this.currentMetrics.memoryUsageMB > memoryThresholdMB * 0.8 ||
           this.currentMetrics.cpuUsagePercent > cpuThresholdPercent * 0.8;
  }
}

// ===========================
// Main Performance Optimizer
// ===========================

export class IPCPerformanceOptimizer extends EventEmitter {
  private batchManager: AdaptiveBatchManager;
  private cacheManager: SmartCacheManager;
  private resourceMonitor: ResourceMonitor;
  private channelMetrics = new Map<string, ChannelMetrics>();
  private optimizationStrategies = new Map<string, OptimizationStrategy>();
  
  constructor(private config: PerformanceConfig = this.getDefaultConfig()) {
    super();
    
    this.batchManager = new AdaptiveBatchManager(config);
    this.cacheManager = new SmartCacheManager(config);
    this.resourceMonitor = new ResourceMonitor(config);
    
    this.startPerformanceOptimization();
    this.setupEventHandlers();
  }

  /**
   * Optimize request processing based on current performance metrics
   */
  async optimizeRequest(
    channel: string,
    request: BaseIPCRequest,
    handler: Function
  ): Promise<any> {
    const strategy = this.getOptimizationStrategy(channel);
    
    // Check resource constraints
    if (this.resourceMonitor.isResourceConstrained()) {
      return this.handleResourceConstrainedRequest(channel, request, handler);
    }
    
    switch (strategy.currentStrategy) {
      case 'batch':
        return this.batchManager.addToBatch(channel, request, handler);
      
      case 'cache':
        return this.handleCachedRequest(channel, request, handler);
      
      case 'stream':
        return this.handleStreamedRequest(channel, request, handler);
      
      case 'direct':
      default:
        return this.handleDirectRequest(channel, request, handler);
    }
  }

  /**
   * Record performance metrics for a completed request
   */
  recordRequestMetrics(
    channel: string,
    executionTime: number,
    success: boolean,
    cacheHit?: boolean
  ): void {
    const metrics = this.channelMetrics.get(channel) || this.createEmptyChannelMetrics();
    
    // Update metrics
    metrics.totalRequests++;
    metrics.totalExecutionTime += executionTime;
    metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.totalRequests;
    
    if (success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }
    
    metrics.errorRate = (metrics.errorCount / metrics.totalRequests) * 100;
    
    // Update percentiles (simplified)
    this.updatePercentiles(metrics, executionTime);
    
    // Update throughput
    const now = Date.now();
    if (!metrics.lastRequestTime) {
      metrics.lastRequestTime = now;
    } else {
      const timeDiff = (now - metrics.lastRequestTime) / 1000; // seconds
      metrics.throughputPerSecond = 1 / timeDiff;
      metrics.lastRequestTime = now;
    }
    
    this.channelMetrics.set(channel, metrics);
    
    // Trigger optimization if needed
    if (metrics.totalRequests % 100 === 0) {
      this.optimizeChannelStrategy(channel);
    }
  }

  private getOptimizationStrategy(channel: string): OptimizationStrategy {
    if (!this.optimizationStrategies.has(channel)) {
      const strategy = this.createDefaultStrategy(channel);
      this.optimizationStrategies.set(channel, strategy);
    }
    return this.optimizationStrategies.get(channel)!;
  }

  private createDefaultStrategy(channel: string): OptimizationStrategy {
    // Determine initial strategy based on channel characteristics
    let strategy: 'batch' | 'stream' | 'cache' | 'direct' = 'direct';
    
    if (channel.includes('search')) {
      strategy = 'cache';
    } else if (channel.includes('get') && !channel.includes('metrics')) {
      strategy = 'batch';
    } else if (channel.includes('stream') || channel.includes('large')) {
      strategy = 'stream';
    }
    
    return {
      channel,
      currentStrategy: strategy,
      performanceScore: 0,
      lastOptimized: Date.now(),
      adjustments: []
    };
  }

  private async optimizeChannelStrategy(channel: string): Promise<void> {
    const metrics = this.channelMetrics.get(channel);
    if (!metrics) return;
    
    const currentStrategy = this.optimizationStrategies.get(channel);
    if (!currentStrategy) return;
    
    const performanceScore = this.calculatePerformanceScore(metrics);
    const shouldOptimize = this.shouldOptimizeStrategy(currentStrategy, performanceScore);
    
    if (shouldOptimize) {
      const newStrategy = await this.selectOptimalStrategy(channel, metrics);
      
      if (newStrategy !== currentStrategy.currentStrategy) {
        const adjustment: OptimizationAdjustment = {
          timestamp: Date.now(),
          parameter: 'strategy',
          oldValue: currentStrategy.currentStrategy,
          newValue: newStrategy,
          reason: this.getOptimizationReason(metrics),
          impact: 'neutral', // Will be updated after measuring impact
          impactScore: 0
        };
        
        currentStrategy.currentStrategy = newStrategy;
        currentStrategy.lastOptimized = Date.now();
        currentStrategy.adjustments.push(adjustment);
        
        this.emit('strategy-changed', {
          channel,
          oldStrategy: adjustment.oldValue,
          newStrategy: adjustment.newValue,
          reason: adjustment.reason
        });
      }
    }
    
    currentStrategy.performanceScore = performanceScore;
  }

  private calculatePerformanceScore(metrics: ChannelMetrics): number {
    // Composite score based on multiple factors (0-100)
    const responseTimeScore = Math.max(0, 100 - (metrics.averageExecutionTime / 10));
    const errorRateScore = Math.max(0, 100 - metrics.errorRate);
    const throughputScore = Math.min(100, metrics.throughputPerSecond * 10);
    
    return (responseTimeScore * 0.4 + errorRateScore * 0.3 + throughputScore * 0.3);
  }

  private shouldOptimizeStrategy(strategy: OptimizationStrategy, performanceScore: number): boolean {
    const timeSinceLastOptimization = Date.now() - strategy.lastOptimized;
    const minOptimizationInterval = 5 * 60 * 1000; // 5 minutes
    
    return timeSinceLastOptimization > minOptimizationInterval &&
           performanceScore < 70; // Optimize if score is below 70
  }

  private async selectOptimalStrategy(
    channel: string, 
    metrics: ChannelMetrics
  ): Promise<'batch' | 'stream' | 'cache' | 'direct'> {
    // Strategy selection based on performance characteristics
    
    if (metrics.averageExecutionTime > 1000 && metrics.errorRate < 5) {
      // High latency, low errors - try caching
      return 'cache';
    }
    
    if (metrics.throughputPerSecond < 10 && channel.includes('get')) {
      // Low throughput for read operations - try batching
      return 'batch';
    }
    
    if (metrics.averageExecutionTime > 2000) {
      // Very high latency - try streaming for large responses
      return 'stream';
    }
    
    // Default to direct processing
    return 'direct';
  }

  private getOptimizationReason(metrics: ChannelMetrics): string {
    if (metrics.averageExecutionTime > 1000) {
      return 'High response time detected';
    }
    
    if (metrics.errorRate > 10) {
      return 'High error rate detected';
    }
    
    if (metrics.throughputPerSecond < 5) {
      return 'Low throughput detected';
    }
    
    return 'Performance optimization';
  }

  private async handleResourceConstrainedRequest(
    channel: string,
    request: BaseIPCRequest,
    handler: Function
  ): Promise<any> {
    // Under resource constraints, prioritize by channel importance
    const priority = this.getChannelPriority(channel);
    
    if (priority === 'low') {
      throw new AppError('RESOURCE_CONSTRAINED', 'System under heavy load, try again later');
    }
    
    // Use direct processing to avoid additional overhead
    return this.handleDirectRequest(channel, request, handler);
  }

  private getChannelPriority(channel: string): 'high' | 'medium' | 'low' {
    if (channel.includes('critical') || channel.includes('health')) {
      return 'high';
    }
    
    if (channel.includes('search') || channel.includes('get')) {
      return 'medium';
    }
    
    return 'low';
  }

  private async handleCachedRequest(
    channel: string,
    request: BaseIPCRequest,
    handler: Function
  ): Promise<any> {
    const cacheKey = this.generateCacheKey(channel, request);
    
    // Try cache first
    const cached = await this.cacheManager.get(cacheKey, channel);
    if (cached !== null) {
      return cached;
    }
    
    // Cache miss - execute handler and cache result
    const result = await handler();
    await this.cacheManager.set(cacheKey, result, channel);
    
    return result;
  }

  private async handleStreamedRequest(
    channel: string,
    request: BaseIPCRequest,
    handler: Function
  ): Promise<any> {
    // This would integrate with the streaming handler
    return handler(); // Simplified for now
  }

  private async handleDirectRequest(
    channel: string,
    request: BaseIPCRequest,
    handler: Function
  ): Promise<any> {
    return handler();
  }

  private generateCacheKey(channel: string, request: BaseIPCRequest): string {
    const keyData = {
      channel,
      // Include relevant request data, but not sensitive information
      requestId: request.requestId,
      timestamp: Math.floor(request.timestamp / 60000) // Round to minute
    };
    
    return `ipc:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  private createEmptyChannelMetrics(): ChannelMetrics {
    return {
      totalRequests: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      successCount: 0,
      errorCount: 0,
      errorRate: 0,
      p50ExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      throughputPerSecond: 0,
      lastRequestTime: 0
    };
  }

  private updatePercentiles(metrics: ChannelMetrics, executionTime: number): void {
    // Simplified percentile calculation
    // In reality, you'd use a more sophisticated data structure
    metrics.p50ExecutionTime = (metrics.p50ExecutionTime + executionTime) / 2;
    metrics.p95ExecutionTime = Math.max(metrics.p95ExecutionTime, executionTime);
    metrics.p99ExecutionTime = Math.max(metrics.p99ExecutionTime, executionTime);
  }

  private startPerformanceOptimization(): void {
    setInterval(() => {
      if (this.config.optimizationConfig.enablePredictiveOptimization) {
        this.performPredictiveOptimization();
      }
    }, this.config.optimizationConfig.optimizationInterval);
  }

  private performPredictiveOptimization(): void {
    // Analyze trends and predict performance issues
    for (const [channel, metrics] of this.channelMetrics.entries()) {
      const trend = this.analyzePerfromanceTrend(channel, metrics);
      
      if (trend.degrading && trend.severity > 0.7) {
        console.warn(`Performance degradation predicted for ${channel}:`, trend);
        // Proactively optimize
        this.optimizeChannelStrategy(channel);
      }
    }
  }

  private analyzePerfromanceTrend(channel: string, metrics: ChannelMetrics): {
    degrading: boolean;
    severity: number;
    factors: string[];
  } {
    const factors: string[] = [];
    let severity = 0;
    
    if (metrics.averageExecutionTime > this.config.optimizationConfig.performanceTargets.responseTimeMs) {
      factors.push('High response time');
      severity += 0.3;
    }
    
    if (metrics.errorRate > this.config.optimizationConfig.performanceTargets.errorRatePercent) {
      factors.push('High error rate');
      severity += 0.4;
    }
    
    if (metrics.throughputPerSecond < this.config.optimizationConfig.performanceTargets.throughputPerSecond) {
      factors.push('Low throughput');
      severity += 0.2;
    }
    
    return {
      degrading: severity > 0,
      severity,
      factors
    };
  }

  private setupEventHandlers(): void {
    this.batchManager.on('batch-optimized', (data) => {
      this.emit('performance-optimized', {
        type: 'batch',
        ...data
      });
    });
  }

  /**
   * Public API methods
   */
  getPerformanceReport(): PerformanceReport {
    const channelReports = Array.from(this.channelMetrics.entries()).map(([channel, metrics]) => ({
      channel,
      healthScore: this.calculatePerformanceScore(metrics),
      ...metrics
    }));

    const systemHealth = channelReports.length > 0 
      ? channelReports.reduce((sum, r) => sum + r.healthScore, 0) / channelReports.length
      : 100;

    return {
      timestamp: Date.now(),
      realTimeMetrics: this.getRealTimeMetrics(),
      channelReports,
      systemHealth,
      recommendations: this.generatePerformanceRecommendations(channelReports)
    };
  }

  private getRealTimeMetrics(): RealTimeMetrics {
    const resourceMetrics = this.resourceMonitor.getCurrentMetrics();
    
    return {
      activeRequests: resourceMetrics.activeRequests,
      queuedRequests: 0, // Would be calculated from batch queues
      errorRate: this.calculateOverallErrorRate(),
      averageResponseTime: this.calculateOverallResponseTime(),
      throughputPerSecond: this.calculateOverallThroughput(),
      memoryUsage: resourceMetrics.memoryUsageMB,
      cpuUsage: resourceMetrics.cpuUsagePercent
    };
  }

  private calculateOverallErrorRate(): number {
    const allMetrics = Array.from(this.channelMetrics.values());
    if (allMetrics.length === 0) return 0;
    
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    
    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  }

  private calculateOverallResponseTime(): number {
    const allMetrics = Array.from(this.channelMetrics.values());
    if (allMetrics.length === 0) return 0;
    
    const totalTime = allMetrics.reduce((sum, m) => sum + m.totalExecutionTime, 0);
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    
    return totalRequests > 0 ? totalTime / totalRequests : 0;
  }

  private calculateOverallThroughput(): number {
    const allMetrics = Array.from(this.channelMetrics.values());
    if (allMetrics.length === 0) return 0;
    
    return allMetrics.reduce((sum, m) => sum + m.throughputPerSecond, 0) / allMetrics.length;
  }

  private generatePerformanceRecommendations(channelReports: any[]): string[] {
    const recommendations: string[] = [];
    
    const slowChannels = channelReports.filter(r => r.averageExecutionTime > 1000);
    if (slowChannels.length > 0) {
      recommendations.push(
        `Consider caching or optimization for slow channels: ${slowChannels.map(c => c.channel).join(', ')}`
      );
    }
    
    const errorProneChannels = channelReports.filter(r => r.errorRate > 5);
    if (errorProneChannels.length > 0) {
      recommendations.push(
        `Review error handling for channels with high error rates: ${errorProneChannels.map(c => c.channel).join(', ')}`
      );
    }
    
    const resourceMetrics = this.resourceMonitor.getCurrentMetrics();
    if (resourceMetrics.memoryUsageMB > this.config.resourceConfig.memoryThresholdMB * 0.8) {
      recommendations.push('Memory usage is high. Consider clearing caches or optimizing memory usage.');
    }
    
    return recommendations;
  }

  getChannelMetrics(channel?: string): Map<string, ChannelMetrics> | ChannelMetrics | null {
    if (channel) {
      return this.channelMetrics.get(channel) || null;
    }
    return new Map(this.channelMetrics);
  }

  getCacheMetrics() {
    return this.cacheManager.getCacheMetrics();
  }

  getResourceMetrics() {
    return this.resourceMonitor.getCurrentMetrics();
  }

  clearCache(channel?: string): void {
    this.cacheManager.clearCache(channel);
  }

  private getDefaultConfig(): PerformanceConfig {
    return {
      batchConfig: {
        enabled: true,
        maxBatchSize: 20,
        maxDelayMs: 100,
        adaptiveBatching: true,
        batchSizeThresholds: {
          low: 5,
          medium: 15,
          high: 30
        }
      },
      cacheConfig: {
        enabled: true,
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        ttlMs: 5 * 60 * 1000, // 5 minutes
        adaptiveTTL: true,
        compressionEnabled: true,
        compressionThreshold: 1024 // 1KB
      },
      resourceConfig: {
        maxConcurrentRequests: 100,
        requestTimeoutMs: 30000,
        memoryThresholdMB: 512,
        cpuThresholdPercent: 80,
        enableResourceMonitoring: true
      },
      optimizationConfig: {
        enablePredictiveOptimization: true,
        learningEnabled: true,
        optimizationInterval: 60000, // 1 minute
        performanceTargets: {
          responseTimeMs: 500,
          throughputPerSecond: 50,
          errorRatePercent: 2
        }
      }
    };
  }
}

// ===========================
// Supporting Interfaces
// ===========================

interface BatchQueue {
  add(item: any): void;
  updateConfig(config: any): void;
}

interface BatchMetrics {
  totalBatches: number;
  totalProcessed: number;
  totalTimeMs: number;
  averageProcessingTimeMs: number;
  averageBatchSize: number;
  maxBatchSize: number;
  errorCount: number;
  memoryUsageBytes: number;
  lastUpdated: number;
}

interface BatchPerformance {
  throughput: number;
  averageLatency: number;
  errorRate: number;
  efficiency: number;
  memoryUsage: number;
}

interface BatchOptimization {
  shouldAdjust: boolean;
  newConfig: any;
  suggestions: string[];
  expectedImpact: number;
}

interface CacheEntry {
  data: any;
  compressed: boolean;
  size: number;
  originalSize: number;
  ttl: number;
  createdAt: number;
  lastAccessed: number;
  hitCount: number;
  channel: string;
}

interface CacheChannelMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  accessFrequency: number;
  averageItemSize: number;
  lastUpdated: number;
}

interface SystemResourceMetrics {
  timestamp: number;
  memoryUsageMB: number;
  memoryTotalMB: number;
  cpuUsagePercent: number;
  activeRequests: number;
  uptime: number;
}

interface PerformanceReport {
  timestamp: number;
  realTimeMetrics: RealTimeMetrics;
  channelReports: Array<{
    channel: string;
    healthScore: number;
  } & ChannelMetrics>;
  systemHealth: number;
  recommendations: string[];
}