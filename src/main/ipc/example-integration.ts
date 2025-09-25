/**
 * Example Integration for Enhanced IPC System
 * This file demonstrates how to integrate the IPCManager into the main application
 */

import { IPCManager } from './IPCManager';
import { IPCHandlers } from './handlers';
import { DatabaseService } from '../services/DatabaseService';
import { AIService } from '../services/AIService';
import { MonitoringService } from '../services/MonitoringService';
import { MultiLayerCacheManager } from '../../caching/MultiLayerCacheManager';

/**
 * Initialize and configure the enhanced IPC system
 */
export class IPCIntegration {
  private ipcManager: IPCManager;
  private ipcHandlers: IPCHandlers;
  private cacheManager: MultiLayerCacheManager;

  constructor(
    databaseService: DatabaseService,
    aiService: AIService,
    monitoringService: MonitoringService
  ) {
    // Initialize cache manager for IPC responses
    this.cacheManager = new MultiLayerCacheManager({
      enableMemoryCache: true,
      memoryCacheOptions: {
        maxSize: 1000,
        ttl: 300000, // 5 minutes default
      },
      enableDiskCache: true,
      diskCacheOptions: {
        maxSize: '100MB',
        ttl: 1800000, // 30 minutes
      },
      enableCompression: true,
    });

    // Initialize IPC Manager with cache
    this.ipcManager = new IPCManager(this.cacheManager);

    // Initialize handlers
    this.ipcHandlers = new IPCHandlers(
      this.ipcManager,
      databaseService,
      aiService,
      monitoringService
    );

    this.setupEventListeners();
    console.log('✅ Enhanced IPC System initialized');
  }

  /**
   * Set up event listeners for monitoring and debugging
   */
  private setupEventListeners(): void {
    // Listen to IPC errors
    this.ipcManager.on('error', error => {
      console.error('IPC Manager Error:', error);
      // Could send to monitoring service
    });

    // Listen to cache invalidation events
    this.ipcManager.on('cache:invalidate', pattern => {
      console.log('Cache invalidation requested:', pattern);
      // Implement specific cache invalidation logic
    });

    // Listen to batch processing events
    this.ipcManager.on('batchError', event => {
      console.error('Batch processing error:', event);
    });

    // Listen to streaming events
    this.ipcManager.on('streamComplete', event => {
      console.log('Stream completed:', event);
    });

    this.ipcManager.on('streamCancelled', event => {
      console.log('Stream cancelled:', event);
    });
  }

  /**
   * Get current IPC performance metrics
   */
  getPerformanceMetrics() {
    const ipcMetrics = this.ipcManager.getMetrics();
    const batchMetrics = this.ipcManager['requestBatcher']?.getMetrics();
    const streamMetrics = this.ipcManager['streamingHandler']?.getMetrics();

    return {
      ipc: ipcMetrics,
      batching: batchMetrics,
      streaming: streamMetrics,
      timestamp: Date.now(),
    };
  }

  /**
   * Get information about registered handlers
   */
  getHandlersInfo() {
    return this.ipcManager.getHandlersInfo();
  }

  /**
   * Invalidate cache for specific patterns
   */
  async invalidateCache(pattern: string): Promise<void> {
    await this.ipcManager.invalidateCache(pattern);
  }

  /**
   * Reset all metrics (useful for testing or monitoring resets)
   */
  resetMetrics(): void {
    this.ipcManager.resetMetrics();
  }

  /**
   * Warm up cache with commonly used data
   */
  async warmupCache(): Promise<void> {
    console.log('🔥 Warming up IPC cache...');

    try {
      // Pre-populate cache with popular entries
      await this.cacheManager.warmup([
        {
          key: 'ipc:db:getPopular:[]',
          generator: async () => {
            // This would typically call the actual service
            return { mockData: 'popular entries' };
          },
          ttl: 300000,
        },
        {
          key: 'ipc:db:getStats:[]',
          generator: async () => {
            return { mockData: 'database stats' };
          },
          ttl: 60000,
        },
      ]);

      console.log('✅ IPC cache warmup completed');
    } catch (error) {
      console.error('❌ IPC cache warmup failed:', error);
    }
  }

  /**
   * Gracefully shutdown the IPC system
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down enhanced IPC system...');

    try {
      // Flush any pending batches
      await this.ipcManager['requestBatcher']?.flushAll();

      // Cancel any active streams
      this.ipcManager['streamingHandler']?.cancelAllStreams();

      // Clean up handlers
      this.ipcHandlers.destroy();

      // Clean up manager
      this.ipcManager.destroy();

      // Clean up cache
      await this.cacheManager.close();

      console.log('✅ Enhanced IPC system shutdown completed');
    } catch (error) {
      console.error('❌ Error during IPC shutdown:', error);
    }
  }
}

/**
 * Example usage in main process
 */
export function initializeEnhancedIPC(
  databaseService: DatabaseService,
  aiService: AIService,
  monitoringService: MonitoringService
): IPCIntegration {
  const ipcIntegration = new IPCIntegration(databaseService, aiService, monitoringService);

  // Set up graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down IPC system...');
    await ipcIntegration.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down IPC system...');
    await ipcIntegration.shutdown();
    process.exit(0);
  });

  // Optionally warm up cache
  ipcIntegration.warmupCache().catch(console.error);

  return ipcIntegration;
}

/**
 * Example custom handler registration
 */
export function registerCustomHandler(ipcManager: IPCManager) {
  // Example of registering a custom batchable handler
  ipcManager.registerHandler(
    'custom:batchedOperation',
    async (event, data) => {
      // Process data
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
      return { processed: data, timestamp: Date.now() };
    },
    {
      batchable: true,
      batchSize: 20,
      batchDelay: 100,
      cacheable: true,
      cacheTTL: 120000,
      validation: args => {
        return args[0] && typeof args[0] === 'object' ? true : 'Data must be an object';
      },
      rateLimit: { requests: 50, window: 60000 },
    }
  );

  // Example of registering a streaming handler
  ipcManager.registerHandler(
    'custom:streamedData',
    async (event, query) => {
      // Return async generator for streaming
      return (async function* () {
        for (let i = 0; i < 1000; i++) {
          yield { id: i, data: `Item ${i}`, query };
          // Simulate async processing
          if (i % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      })();
    },
    {
      streamable: true,
      streamChunkSize: 50,
      validation: args => {
        return args[0] && typeof args[0] === 'string' ? true : 'Query must be a string';
      },
    }
  );
}
