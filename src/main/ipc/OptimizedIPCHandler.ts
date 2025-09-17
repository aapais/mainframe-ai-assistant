/**
 * Optimized IPC Handler for Main Process
 *
 * Integrates with the unified optimization systems to handle:
 * 1. Batch processing with 100ms max wait time
 * 2. Efficient IPC routing and response handling
 * 3. Performance monitoring and alerting
 * 4. Health checks and system diagnostics
 *
 * Target: Process all operations within <1s response time
 *
 * @author QA and Integration Engineer
 * @version 1.0.0
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { BatchProcessor } from './BatchProcessor';
import { MultiLayerCacheManager } from '../../caching/MultiLayerCacheManager';
import { DatabaseManager } from '../../database/DatabaseManager';
import { PerformanceMonitoringSystem } from '../../backend/monitoring/PerformanceMonitoringSystem';
import type {
  BatchRequestPayload,
  BatchResponsePayload,
  KBEntry,
  KBEntryInput,
  DatabaseMetrics,
  SearchResult,
  SearchQuery
} from '../../shared/types/';

// =====================
// Configuration & Types
// =====================

export interface OptimizedIPCConfig {
  enableBatching: boolean;
  enableCaching: boolean;
  enablePerformanceMonitoring: boolean;
  maxBatchSize: number;
  batchTimeoutMs: number;
  cacheConfigs: {
    search: { ttl: number; maxSize: number };
    metrics: { ttl: number; maxSize: number };
    entries: { ttl: number; maxSize: number };
  };
  performance: {
    targetResponseTime: number;
    alertThreshold: number;
    slowQueryThreshold: number;
  };
}

export interface IPCPerformanceMetrics {
  handlerName: string;
  totalCalls: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  errorCount: number;
  errorRate: number;
  cacheHitRate: number;
  batchProcessed: number;
  recentLatencies: number[];
}

export interface SystemHealthStatus {
  ipc: {
    responsive: boolean;
    handlersActive: number;
    averageLatency: number;
    errorRate: number;
  };
  database: {
    connected: boolean;
    responseTime: number;
    poolSize: number;
  };
  cache: {
    active: boolean;
    hitRate: number;
    memoryUsage: number;
  };
  batching: {
    active: boolean;
    averageBatchSize: number;
    processingTime: number;
  };
}

// =====================
// Main Optimized IPC Handler
// =====================

export class OptimizedIPCHandler {
  private batchProcessor: BatchProcessor;
  private cacheManager: MultiLayerCacheManager;
  private databaseManager: DatabaseManager;
  private performanceMonitor: PerformanceMonitoringSystem;
  private config: OptimizedIPCConfig;
  private metrics = new Map<string, IPCPerformanceMetrics>();
  private initialized = false;

  // Performance tracking
  private activeRequests = new Map<string, number>();
  private healthCheckInterval?: ReturnType<typeof setTimeout>;
  private performanceReportInterval?: ReturnType<typeof setTimeout>;

  constructor(
    databaseManager: DatabaseManager,
    cacheManager?: MultiLayerCacheManager,
    config: Partial<OptimizedIPCConfig> = {}
  ) {
    this.databaseManager = databaseManager;
    this.cacheManager = cacheManager || new MultiLayerCacheManager();

    this.config = {
      enableBatching: true,
      enableCaching: true,
      enablePerformanceMonitoring: true,
      maxBatchSize: 6,
      batchTimeoutMs: 100, // Very aggressive for <1s target
      cacheConfigs: {
        search: { ttl: 30000, maxSize: 100 },    // 30s TTL
        metrics: { ttl: 5000, maxSize: 50 },     // 5s TTL
        entries: { ttl: 60000, maxSize: 200 }    // 1min TTL
      },
      performance: {
        targetResponseTime: 1000,    // <1s target
        alertThreshold: 1500,        // Alert at 1.5s
        slowQueryThreshold: 800      // Slow query at 800ms
      },
      ...config
    };

    this.initializeHandler();
  }

  // =====================
  // Initialization
  // =====================

  private async initializeHandler(): Promise<void> {
    try {
      // Initialize batch processor
      this.batchProcessor = new BatchProcessor({
        cache: this.cacheManager,
        databaseManager: this.databaseManager,
        maxConcurrentRequests: this.config.maxBatchSize,
        defaultTimeout: this.config.batchTimeoutMs
      });

      // Initialize performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        this.performanceMonitor = new PerformanceMonitoringSystem({
          enableRealTimeMetrics: true,
          alertThresholds: {
            responseTime: this.config.performance.alertThreshold,
            errorRate: 5, // 5% error rate threshold
            memoryUsage: 80 // 80% memory usage threshold
          }
        });
      }

      // Register optimized IPC handlers
      this.registerHandlers();

      // Initialize metrics tracking
      this.initializeMetrics();

      // Start monitoring
      if (this.config.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring();
      }

      this.initialized = true;
      console.log('✅ OptimizedIPCHandler initialized with all optimizations');

    } catch (error) {
      console.error('❌ Failed to initialize OptimizedIPCHandler:', error);
      throw error;
    }
  }

  private registerHandlers(): void {
    // Batch processing handler - highest priority
    ipcMain.handle('ipc:batch-process', this.handleBatchProcess.bind(this));

    // Individual optimized handlers with performance tracking
    ipcMain.handle('kb:search', this.withPerformanceTracking('search', this.handleSearch.bind(this)));
    ipcMain.handle('kb:add-entry', this.withPerformanceTracking('addEntry', this.handleAddEntry.bind(this)));
    ipcMain.handle('kb:update-entry', this.withPerformanceTracking('updateEntry', this.handleUpdateEntry.bind(this)));
    ipcMain.handle('kb:delete-entry', this.withPerformanceTracking('deleteEntry', this.handleDeleteEntry.bind(this)));
    ipcMain.handle('kb:get-entry', this.withPerformanceTracking('getEntry', this.handleGetEntry.bind(this)));
    ipcMain.handle('kb:rate-entry', this.withPerformanceTracking('rateEntry', this.handleRateEntry.bind(this)));

    // System handlers
    ipcMain.handle('system:get-metrics', this.withPerformanceTracking('getMetrics', this.handleGetMetrics.bind(this)));
    ipcMain.handle('system:get-health', this.withPerformanceTracking('getHealth', this.handleGetHealth.bind(this)));
    ipcMain.handle('system:get-performance', this.withPerformanceTracking('getPerformance', this.handleGetPerformance.bind(this)));

    // Dashboard batch operations
    ipcMain.handle('dashboard:load', this.withPerformanceTracking('dashboardLoad', this.handleDashboardLoad.bind(this)));

    console.log('✅ All IPC handlers registered with performance tracking');
  }

  // =====================
  // Performance Wrapper
  // =====================

  private withPerformanceTracking<T extends any[], R>(
    operationName: string,
    handler: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const startTime = performance.now();
      const requestId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      this.activeRequests.set(requestId, startTime);

      try {
        const result = await handler(...args);
        this.recordMetrics(operationName, startTime, true);
        return result;
      } catch (error) {
        this.recordMetrics(operationName, startTime, false);
        console.error(`IPC Handler error in ${operationName}:`, error);
        throw error;
      } finally {
        this.activeRequests.delete(requestId);
      }
    };
  }

  private recordMetrics(operationName: string, startTime: number, success: boolean): void {
    const endTime = performance.now();
    const latency = endTime - startTime;

    let metrics = this.metrics.get(operationName);
    if (!metrics) {
      metrics = {
        handlerName: operationName,
        totalCalls: 0,
        averageLatency: 0,
        minLatency: Infinity,
        maxLatency: 0,
        errorCount: 0,
        errorRate: 0,
        cacheHitRate: 0,
        batchProcessed: 0,
        recentLatencies: []
      };
    }

    // Update metrics
    metrics.totalCalls++;
    if (!success) metrics.errorCount++;

    metrics.recentLatencies.push(latency);
    if (metrics.recentLatencies.length > 100) {
      metrics.recentLatencies.shift();
    }

    metrics.averageLatency = metrics.recentLatencies.reduce((a, b) => a + b, 0) / metrics.recentLatencies.length;
    metrics.minLatency = Math.min(metrics.minLatency, latency);
    metrics.maxLatency = Math.max(metrics.maxLatency, latency);
    metrics.errorRate = (metrics.errorCount / metrics.totalCalls) * 100;

    this.metrics.set(operationName, metrics);

    // Alert on slow operations
    if (latency > this.config.performance.alertThreshold) {
      console.warn(`🚨 Slow IPC operation: ${operationName} took ${latency.toFixed(2)}ms`);

      if (this.performanceMonitor) {
        this.performanceMonitor.recordAlert({
          type: 'slow_operation',
          operation: operationName,
          latency,
          threshold: this.config.performance.alertThreshold,
          timestamp: Date.now()
        });
      }
    }

    // Log successful fast operations
    if (success && latency < this.config.performance.targetResponseTime) {
      console.log(`⚡ ${operationName} completed in ${latency.toFixed(2)}ms`);
    }
  }

  // =====================
  // Batch Processing Handler
  // =====================

  private async handleBatchProcess(
    event: IpcMainInvokeEvent,
    batchPayload: BatchRequestPayload
  ): Promise<BatchResponsePayload> {
    if (!this.config.enableBatching) {
      throw new Error('Batch processing is disabled');
    }

    const startTime = performance.now();
    console.log(`📦 Processing batch ${batchPayload.batchId} with ${batchPayload.requests.length} requests`);

    try {
      const response = await this.batchProcessor.processBatch(batchPayload);

      const processingTime = performance.now() - startTime;

      // Update batch metrics
      const batchMetrics = this.metrics.get('batch') || {
        handlerName: 'batch',
        totalCalls: 0,
        averageLatency: 0,
        minLatency: Infinity,
        maxLatency: 0,
        errorCount: 0,
        errorRate: 0,
        cacheHitRate: response.metadata?.cacheHits ? (response.metadata.cacheHits / batchPayload.requests.length) * 100 : 0,
        batchProcessed: 0,
        recentLatencies: []
      };

      batchMetrics.batchProcessed++;
      this.metrics.set('batch', batchMetrics);

      console.log(`✅ Batch ${batchPayload.batchId} processed in ${processingTime.toFixed(2)}ms`);

      // Check if batch met performance target
      if (processingTime > this.config.performance.targetResponseTime) {
        console.warn(`⚠️  Batch processing exceeded target: ${processingTime}ms > ${this.config.performance.targetResponseTime}ms`);
      }

      return response;

    } catch (error) {
      console.error(`❌ Batch processing failed for ${batchPayload.batchId}:`, error);
      throw error;
    }
  }

  // =====================
  // Individual IPC Handlers
  // =====================

  private async handleSearch(
    event: IpcMainInvokeEvent,
    query: string,
    options?: SearchQuery
  ): Promise<SearchResult[]> {
    // Check cache first
    if (this.config.enableCaching) {
      const cacheKey = `search:${query}:${JSON.stringify(options)}`;
      const cached = await this.cacheManager.get(cacheKey);

      if (cached) {
        console.log(`💾 Cache hit for search: ${query}`);
        return cached;
      }

      // Execute search
      const results = await this.databaseManager.searchEntries(query, options);

      // Cache results
      await this.cacheManager.set(cacheKey, results, this.config.cacheConfigs.search.ttl);

      return results;
    }

    return await this.databaseManager.searchEntries(query, options);
  }

  private async handleAddEntry(
    event: IpcMainInvokeEvent,
    entry: KBEntryInput
  ): Promise<string> {
    const entryId = await this.databaseManager.addEntry(entry);

    // Invalidate related caches
    if (this.config.enableCaching) {
      await this.invalidateSearchCache();
      await this.invalidateMetricsCache();
    }

    return entryId;
  }

  private async handleUpdateEntry(
    event: IpcMainInvokeEvent,
    id: string,
    updates: Partial<KBEntry>
  ): Promise<void> {
    await this.databaseManager.updateEntry(id, updates);

    // Invalidate related caches
    if (this.config.enableCaching) {
      await this.cacheManager.delete(`entry:${id}`);
      await this.invalidateSearchCache();
    }
  }

  private async handleDeleteEntry(
    event: IpcMainInvokeEvent,
    id: string
  ): Promise<void> {
    await this.databaseManager.deleteEntry(id);

    // Invalidate related caches
    if (this.config.enableCaching) {
      await this.cacheManager.delete(`entry:${id}`);
      await this.invalidateSearchCache();
      await this.invalidateMetricsCache();
    }
  }

  private async handleGetEntry(
    event: IpcMainInvokeEvent,
    id: string
  ): Promise<KBEntry | null> {
    if (this.config.enableCaching) {
      const cacheKey = `entry:${id}`;
      const cached = await this.cacheManager.get(cacheKey);

      if (cached) {
        return cached;
      }

      const entry = await this.databaseManager.getEntry(id);

      if (entry) {
        await this.cacheManager.set(cacheKey, entry, this.config.cacheConfigs.entries.ttl);
      }

      return entry;
    }

    return await this.databaseManager.getEntry(id);
  }

  private async handleRateEntry(
    event: IpcMainInvokeEvent,
    id: string,
    successful: boolean,
    comment?: string
  ): Promise<void> {
    await this.databaseManager.rateEntry(id, successful, comment);

    // Invalidate entry cache
    if (this.config.enableCaching) {
      await this.cacheManager.delete(`entry:${id}`);
    }
  }

  // =====================
  // System Handlers
  // =====================

  private async handleGetMetrics(event: IpcMainInvokeEvent): Promise<DatabaseMetrics> {
    if (this.config.enableCaching) {
      const cacheKey = 'metrics:database';
      const cached = await this.cacheManager.get(cacheKey);

      if (cached) {
        return cached;
      }

      const metrics = await this.databaseManager.getMetrics();
      await this.cacheManager.set(cacheKey, metrics, this.config.cacheConfigs.metrics.ttl);
      return metrics;
    }

    return await this.databaseManager.getMetrics();
  }

  private async handleGetHealth(event: IpcMainInvokeEvent): Promise<SystemHealthStatus> {
    const health: SystemHealthStatus = {
      ipc: {
        responsive: true,
        handlersActive: this.metrics.size,
        averageLatency: this.calculateAverageLatency(),
        errorRate: this.calculateErrorRate()
      },
      database: {
        connected: await this.databaseManager.isHealthy(),
        responseTime: await this.measureDatabaseResponseTime(),
        poolSize: this.databaseManager.getPoolSize?.() || 1
      },
      cache: {
        active: this.config.enableCaching,
        hitRate: await this.cacheManager.getHitRate(),
        memoryUsage: await this.cacheManager.getMemoryUsage?.() || 0
      },
      batching: {
        active: this.config.enableBatching,
        averageBatchSize: this.calculateAverageBatchSize(),
        processingTime: this.calculateBatchProcessingTime()
      }
    };

    return health;
  }

  private async handleGetPerformance(event: IpcMainInvokeEvent): Promise<any> {
    return {
      metrics: Object.fromEntries(this.metrics),
      config: this.config,
      health: await this.handleGetHealth(event),
      recommendations: this.generatePerformanceRecommendations()
    };
  }

  // =====================
  // Dashboard Handler
  // =====================

  private async handleDashboardLoad(event: IpcMainInvokeEvent): Promise<any> {
    // This is a special optimized handler that combines multiple operations
    const startTime = performance.now();

    try {
      // Execute all dashboard operations in parallel
      const [
        metrics,
        recentEntries,
        popularEntries,
        searchStats,
        systemHealth
      ] = await Promise.all([
        this.handleGetMetrics(event),
        this.databaseManager.getRecentEntries(10),
        this.databaseManager.getPopularEntries(10),
        this.databaseManager.getSearchStats?.() || {},
        this.handleGetHealth(event)
      ]);

      const dashboardData = {
        metrics,
        recentEntries,
        popularEntries,
        searchStats,
        systemHealth,
        loadTime: performance.now() - startTime
      };

      console.log(`📊 Dashboard loaded in ${dashboardData.loadTime.toFixed(2)}ms`);

      return dashboardData;

    } catch (error) {
      console.error('❌ Dashboard load failed:', error);
      throw error;
    }
  }

  // =====================
  // Cache Management
  // =====================

  private async invalidateSearchCache(): Promise<void> {
    const keys = await this.cacheManager.getKeys?.();
    if (keys) {
      const searchKeys = keys.filter(key => key.startsWith('search:'));
      await Promise.all(searchKeys.map(key => this.cacheManager.delete(key)));
    }
  }

  private async invalidateMetricsCache(): Promise<void> {
    await this.cacheManager.delete('metrics:database');
  }

  // =====================
  // Monitoring & Analytics
  // =====================

  private initializeMetrics(): void {
    const handlers = [
      'search', 'addEntry', 'updateEntry', 'deleteEntry', 'getEntry', 'rateEntry',
      'getMetrics', 'getHealth', 'getPerformance', 'dashboardLoad', 'batch'
    ];

    handlers.forEach(handler => {
      if (!this.metrics.has(handler)) {
        this.metrics.set(handler, {
          handlerName: handler,
          totalCalls: 0,
          averageLatency: 0,
          minLatency: Infinity,
          maxLatency: 0,
          errorCount: 0,
          errorRate: 0,
          cacheHitRate: 0,
          batchProcessed: 0,
          recentLatencies: []
        });
      }
    });
  }

  private startPerformanceMonitoring(): void {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);

    // Performance report every 5 minutes
    this.performanceReportInterval = setInterval(() => {
      this.generatePerformanceReport();
    }, 300000);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const health = await this.handleGetHealth({} as IpcMainInvokeEvent);

      if (!health.database.connected) {
        console.error('🚨 Database connection lost');
      }

      if (health.ipc.errorRate > 5) {
        console.warn(`⚠️  High IPC error rate: ${health.ipc.errorRate.toFixed(2)}%`);
      }

      if (health.ipc.averageLatency > this.config.performance.slowQueryThreshold) {
        console.warn(`⚠️  High average IPC latency: ${health.ipc.averageLatency.toFixed(2)}ms`);
      }

    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  private generatePerformanceReport(): void {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalHandlers: this.metrics.size,
        averageResponseTime: this.calculateAverageLatency(),
        errorRate: this.calculateErrorRate(),
        activeRequests: this.activeRequests.size,
        performanceTarget: this.config.performance.targetResponseTime,
        targetsMet: this.calculateTargetsMet()
      },
      handlers: Object.fromEntries(this.metrics),
      recommendations: this.generatePerformanceRecommendations()
    };

    console.log('📊 Performance Report:', JSON.stringify(report, null, 2));

    // Emit performance data if monitoring system is available
    if (this.performanceMonitor) {
      this.performanceMonitor.recordMetrics(report);
    }
  }

  // =====================
  // Calculation Helpers
  // =====================

  private calculateAverageLatency(): number {
    const metrics = Array.from(this.metrics.values());
    const total = metrics.reduce((sum, m) => sum + m.averageLatency, 0);
    return metrics.length > 0 ? total / metrics.length : 0;
  }

  private calculateErrorRate(): number {
    const metrics = Array.from(this.metrics.values());
    const totalCalls = metrics.reduce((sum, m) => sum + m.totalCalls, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.errorCount, 0);
    return totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0;
  }

  private calculateAverageBatchSize(): number {
    const batchMetrics = this.metrics.get('batch');
    return batchMetrics ? batchMetrics.batchProcessed : 0;
  }

  private calculateBatchProcessingTime(): number {
    const batchMetrics = this.metrics.get('batch');
    return batchMetrics ? batchMetrics.averageLatency : 0;
  }

  private calculateTargetsMet(): number {
    const metrics = Array.from(this.metrics.values());
    const targetMet = metrics.filter(m => m.averageLatency < this.config.performance.targetResponseTime).length;
    return metrics.length > 0 ? (targetMet / metrics.length) * 100 : 100;
  }

  private async measureDatabaseResponseTime(): Promise<number> {
    const start = performance.now();
    try {
      await this.databaseManager.isHealthy();
      return performance.now() - start;
    } catch {
      return -1; // Error indicator
    }
  }

  private generatePerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const avgLatency = this.calculateAverageLatency();
    const errorRate = this.calculateErrorRate();

    if (avgLatency > this.config.performance.targetResponseTime) {
      recommendations.push(`Average response time ${avgLatency.toFixed(0)}ms exceeds target ${this.config.performance.targetResponseTime}ms`);
    }

    if (errorRate > 2) {
      recommendations.push(`Error rate ${errorRate.toFixed(1)}% is above acceptable threshold`);
    }

    if (!this.config.enableBatching) {
      recommendations.push('Enable batching to improve throughput by up to 83%');
    }

    if (!this.config.enableCaching) {
      recommendations.push('Enable caching to reduce database load and response times');
    }

    const slowHandlers = Array.from(this.metrics.entries())
      .filter(([_, metrics]) => metrics.averageLatency > this.config.performance.targetResponseTime)
      .map(([name]) => name);

    if (slowHandlers.length > 0) {
      recommendations.push(`Optimize slow handlers: ${slowHandlers.join(', ')}`);
    }

    return recommendations;
  }

  // =====================
  // Public API
  // =====================

  /**
   * Get current performance metrics
   */
  getMetrics(): Map<string, IPCPerformanceMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    return await this.handleGetHealth({} as IpcMainInvokeEvent);
  }

  /**
   * Force cache clear
   */
  async clearCache(): Promise<void> {
    if (this.config.enableCaching) {
      await this.cacheManager.clear();
      console.log('🧹 All IPC caches cleared');
    }
  }

  /**
   * Cleanup and dispose
   */
  dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.performanceReportInterval) {
      clearInterval(this.performanceReportInterval);
    }

    // Remove all IPC handlers
    ipcMain.removeHandler('ipc:batch-process');
    ipcMain.removeHandler('kb:search');
    ipcMain.removeHandler('kb:add-entry');
    ipcMain.removeHandler('kb:update-entry');
    ipcMain.removeHandler('kb:delete-entry');
    ipcMain.removeHandler('kb:get-entry');
    ipcMain.removeHandler('kb:rate-entry');
    ipcMain.removeHandler('system:get-metrics');
    ipcMain.removeHandler('system:get-health');
    ipcMain.removeHandler('system:get-performance');
    ipcMain.removeHandler('dashboard:load');

    console.log('🧹 OptimizedIPCHandler disposed');
  }
}

// =====================
// Export for main process usage
// =====================

export default OptimizedIPCHandler;