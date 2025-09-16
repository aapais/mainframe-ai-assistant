import { Service, ServiceContext, ServiceDependency, ServiceMetrics } from './ServiceManager';
import { IPCIntegration, initializeEnhancedIPC } from '../ipc';
import { DatabaseService } from './DatabaseService';
import { AIService } from './AIService';
import { MonitoringService } from './MonitoringService';

/**
 * Enhanced IPC Service with batching, streaming, and caching
 * Replaces the basic IPCService with advanced features
 */
export class EnhancedIPCService extends Service {
  name = 'EnhancedIPCService';
  dependencies: ServiceDependency[] = [
    { name: 'DatabaseService', required: true },
    { name: 'AIService', required: true },
    { name: 'MonitoringService', required: false }
  ];

  private ipcIntegration?: IPCIntegration;

  async initialize(context: ServiceContext): Promise<void> {
    try {
      console.log('🔌 Initializing Enhanced IPC Service...');

      // Get required services
      const databaseService = context.getService('DatabaseService') as DatabaseService;
      const aiService = context.getService('AIService') as AIService;
      const monitoringService = context.getService('MonitoringService') as MonitoringService;

      if (!databaseService) {
        throw new Error('DatabaseService is required for Enhanced IPC Service');
      }

      if (!aiService) {
        throw new Error('AIService is required for Enhanced IPC Service');
      }

      // Initialize enhanced IPC system
      this.ipcIntegration = initializeEnhancedIPC(
        databaseService,
        aiService,
        monitoringService
      );

      // Set up monitoring integration if available
      if (monitoringService && this.ipcIntegration) {
        this.setupMonitoringIntegration(monitoringService);
      }

      // Warm up cache for better initial performance
      await this.ipcIntegration.warmupCache();

      this.setStatus('running');
      console.log('✅ Enhanced IPC Service initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Enhanced IPC Service:', error);
      this.setStatus('failed', error as Error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Enhanced IPC Service...');
    
    try {
      if (this.ipcIntegration) {
        await this.ipcIntegration.shutdown();
        this.ipcIntegration = undefined;
      }

      this.setStatus('stopped');
      console.log('✅ Enhanced IPC Service shutdown complete');

    } catch (error) {
      console.error('❌ Error during Enhanced IPC Service shutdown:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, any>;
    issues: string[];
  }> {
    const issues: string[] = [];
    const details: Record<string, any> = {};

    try {
      // Check if IPC integration is available
      if (!this.ipcIntegration) {
        issues.push('IPC integration not initialized');
        return { healthy: false, details, issues };
      }

      // Get performance metrics
      const metrics = this.ipcIntegration.getPerformanceMetrics();
      details.metrics = metrics;

      // Check for performance issues
      if (metrics.ipc.averageResponseTime > 1000) {
        issues.push(`High average response time: ${metrics.ipc.averageResponseTime}ms`);
      }

      if (metrics.ipc.totalErrors / Math.max(metrics.ipc.totalRequests, 1) > 0.05) {
        issues.push(`High error rate: ${((metrics.ipc.totalErrors / metrics.ipc.totalRequests) * 100).toFixed(2)}%`);
      }

      if (metrics.ipc.cacheHitRate < 50) {
        issues.push(`Low cache hit rate: ${metrics.ipc.cacheHitRate.toFixed(2)}%`);
      }

      // Check handler information
      const handlers = this.ipcIntegration.getHandlersInfo();
      details.registeredHandlers = handlers.length;
      details.handlerTypes = handlers.map(h => ({
        channel: h.channel,
        batchable: h.config.batchable,
        streamable: h.config.streamable,
        cacheable: h.config.cacheable
      }));

      return {
        healthy: issues.length === 0,
        details,
        issues
      };

    } catch (error) {
      issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { healthy: false, details, issues };
    }
  }

  getMetrics(): ServiceMetrics {
    const baseMetrics = super.getMetrics();
    
    if (!this.ipcIntegration) {
      return baseMetrics;
    }

    const performanceMetrics = this.ipcIntegration.getPerformanceMetrics();
    
    return {
      ...baseMetrics,
      custom: {
        ipc: {
          totalRequests: performanceMetrics.ipc.totalRequests,
          totalResponses: performanceMetrics.ipc.totalResponses,
          totalErrors: performanceMetrics.ipc.totalErrors,
          averageResponseTime: performanceMetrics.ipc.averageResponseTime,
          cacheHitRate: performanceMetrics.ipc.cacheHitRate,
          batchedRequests: performanceMetrics.ipc.batchedRequests,
          streamedRequests: performanceMetrics.ipc.streamedRequests
        },
        batching: performanceMetrics.batching ? {
          totalBatches: performanceMetrics.batching.totalBatches,
          totalRequests: performanceMetrics.batching.totalRequests,
          averageBatchSize: performanceMetrics.batching.averageBatchSize,
          averageProcessingTime: performanceMetrics.batching.averageProcessingTime,
          failedBatches: performanceMetrics.batching.failedBatches
        } : null,
        streaming: performanceMetrics.streaming ? {
          totalStreams: performanceMetrics.streaming.totalStreams,
          totalChunks: performanceMetrics.streaming.totalChunks,
          totalBytes: performanceMetrics.streaming.totalBytes,
          averageChunkSize: performanceMetrics.streaming.averageChunkSize,
          averageStreamTime: performanceMetrics.streaming.averageStreamTime,
          failedStreams: performanceMetrics.streaming.failedStreams
        } : null
      }
    };
  }

  /**
   * Get the IPC integration instance for advanced operations
   */
  getIPCIntegration(): IPCIntegration | undefined {
    return this.ipcIntegration;
  }

  /**
   * Invalidate cache for specific patterns
   */
  async invalidateCache(pattern: string): Promise<void> {
    if (this.ipcIntegration) {
      await this.ipcIntegration.invalidateCache(pattern);
    }
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    if (this.ipcIntegration) {
      this.ipcIntegration.resetMetrics();
    }
  }

  /**
   * Get detailed handler information
   */
  getHandlersInfo() {
    return this.ipcIntegration?.getHandlersInfo() || [];
  }

  /**
   * Set up monitoring integration
   */
  private setupMonitoringIntegration(monitoringService: MonitoringService): void {
    if (!this.ipcIntegration) return;

    // Report IPC metrics to monitoring service
    const reportMetrics = () => {
      try {
        const metrics = this.ipcIntegration!.getPerformanceMetrics();
        
        // Report to monitoring service
        monitoringService.recordMetric('ipc.requests.total', metrics.ipc.totalRequests);
        monitoringService.recordMetric('ipc.responses.total', metrics.ipc.totalResponses);
        monitoringService.recordMetric('ipc.errors.total', metrics.ipc.totalErrors);
        monitoringService.recordMetric('ipc.response_time.average', metrics.ipc.averageResponseTime);
        monitoringService.recordMetric('ipc.cache.hit_rate', metrics.ipc.cacheHitRate);
        monitoringService.recordMetric('ipc.batched.requests', metrics.ipc.batchedRequests);
        monitoringService.recordMetric('ipc.streamed.requests', metrics.ipc.streamedRequests);

        if (metrics.batching) {
          monitoringService.recordMetric('ipc.batching.total_batches', metrics.batching.totalBatches);
          monitoringService.recordMetric('ipc.batching.average_size', metrics.batching.averageBatchSize);
          monitoringService.recordMetric('ipc.batching.average_time', metrics.batching.averageProcessingTime);
        }

        if (metrics.streaming) {
          monitoringService.recordMetric('ipc.streaming.total_streams', metrics.streaming.totalStreams);
          monitoringService.recordMetric('ipc.streaming.total_chunks', metrics.streaming.totalChunks);
          monitoringService.recordMetric('ipc.streaming.total_bytes', metrics.streaming.totalBytes);
        }

      } catch (error) {
        console.error('Error reporting IPC metrics to monitoring service:', error);
      }
    };

    // Report metrics every 30 seconds
    const metricsInterval = setInterval(reportMetrics, 30000);
    
    // Clean up interval on shutdown
    this.on('shutdown', () => {
      clearInterval(metricsInterval);
    });

    // Report initial metrics
    setTimeout(reportMetrics, 5000);
  }
}

/**
 * Export factory function for easier integration
 */
export function createEnhancedIPCService(): EnhancedIPCService {
  return new EnhancedIPCService();
}