/**
 * Cache Performance Optimizer
 *
 * Provides advanced optimization techniques including connection pooling,
 * lazy loading, and performance monitoring for the cache system.
 */

import { EventEmitter } from 'events';
import { RedisService } from './RedisService';
import { InMemoryCache } from './InMemoryCache';
import { CacheMetrics } from './CacheMetrics';
import { Logger } from '../utils/Logger';

export interface ConnectionPoolConfig {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
  propagateCreateError: boolean;
}

export interface OptimizationConfig {
  connectionPool: ConnectionPoolConfig;
  lazyLoading: {
    enabled: boolean;
    preloadThreshold: number;
    maxPreloadSize: number;
  };
  compression: {
    enabled: boolean;
    threshold: number;
    algorithm: 'gzip' | 'lz4' | 'snappy';
  };
  batching: {
    enabled: boolean;
    batchSize: number;
    flushInterval: number;
  };
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTime: number;
    monitoringPeriod: number;
  };
}

/**
 * Connection Pool for Redis connections
 */
class RedisConnectionPool extends EventEmitter {
  private connections: RedisService[] = [];
  private available: RedisService[] = [];
  private pending: Array<{
    resolve: (connection: RedisService) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private destroyed = false;
  private logger: Logger;

  constructor(
    private config: ConnectionPoolConfig,
    private redisConfig: any
  ) {
    super();
    this.logger = new Logger('RedisConnectionPool');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Create minimum connections
    for (let i = 0; i < this.config.min; i++) {
      try {
        const connection = await this.createConnection();
        this.connections.push(connection);
        this.available.push(connection);
      } catch (error) {
        this.logger.error('Failed to create initial connection:', error);
      }
    }

    // Start reaper for idle connections
    setInterval(() => this.reapIdleConnections(), this.config.reapIntervalMillis);
  }

  private async createConnection(): Promise<RedisService> {
    const connection = new RedisService(this.redisConfig);
    await connection.connect();

    connection.on('error', (error) => {
      this.logger.warn('Connection error:', error);
      this.removeConnection(connection);
    });

    connection.on('disconnect', () => {
      this.removeConnection(connection);
    });

    return connection;
  }

  private removeConnection(connection: RedisService): void {
    const connectionIndex = this.connections.indexOf(connection);
    if (connectionIndex !== -1) {
      this.connections.splice(connectionIndex, 1);
    }

    const availableIndex = this.available.indexOf(connection);
    if (availableIndex !== -1) {
      this.available.splice(availableIndex, 1);
    }
  }

  private reapIdleConnections(): void {
    if (this.connections.length <= this.config.min) {
      return;
    }

    const now = Date.now();
    const connectionsToRemove: RedisService[] = [];

    for (const connection of this.available) {
      if (now - connection.getLastUsed() > this.config.idleTimeoutMillis) {
        connectionsToRemove.push(connection);
      }
    }

    for (const connection of connectionsToRemove) {
      if (this.connections.length > this.config.min) {
        this.removeConnection(connection);
        connection.disconnect();
      }
    }
  }

  async acquire(): Promise<RedisService> {
    if (this.destroyed) {
      throw new Error('Connection pool has been destroyed');
    }

    // Try to get available connection
    if (this.available.length > 0) {
      const connection = this.available.pop()!;
      connection.markUsed();
      return connection;
    }

    // Create new connection if under max
    if (this.connections.length < this.config.max) {
      try {
        const connection = await this.createConnection();
        this.connections.push(connection);
        connection.markUsed();
        return connection;
      } catch (error) {
        this.logger.error('Failed to create new connection:', error);
      }
    }

    // Wait for available connection
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.pending.findIndex(p => p.resolve === resolve);
        if (index !== -1) {
          this.pending.splice(index, 1);
        }
        reject(new Error('Connection acquire timeout'));
      }, this.config.acquireTimeoutMillis);

      this.pending.push({
        resolve: (connection) => {
          clearTimeout(timeout);
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: Date.now()
      });
    });
  }

  release(connection: RedisService): void {
    if (!this.connections.includes(connection)) {
      return;
    }

    // Serve pending requests first
    if (this.pending.length > 0) {
      const pending = this.pending.shift()!;
      connection.markUsed();
      pending.resolve(connection);
      return;
    }

    // Return to available pool
    this.available.push(connection);
  }

  async destroy(): Promise<void> {
    this.destroyed = true;

    // Reject all pending requests
    for (const pending of this.pending) {
      pending.reject(new Error('Connection pool destroyed'));
    }
    this.pending.length = 0;

    // Close all connections
    const closePromises = this.connections.map(connection =>
      connection.disconnect().catch(error =>
        this.logger.error('Error closing connection:', error)
      )
    );

    await Promise.all(closePromises);
    this.connections.length = 0;
    this.available.length = 0;
  }

  getStats(): {
    total: number;
    available: number;
    pending: number;
    destroyed: boolean;
  } {
    return {
      total: this.connections.length,
      available: this.available.length,
      pending: this.pending.length,
      destroyed: this.destroyed
    };
  }
}

/**
 * Circuit Breaker for cache operations
 */
class CircuitBreaker extends EventEmitter {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private logger: Logger;

  constructor(private config: OptimizationConfig['circuitBreaker']) {
    super();
    this.logger = new Logger('CircuitBreaker');
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) {
      return operation();
    }

    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.config.recoveryTime) {
        this.state = 'half-open';
        this.logger.info('Circuit breaker moving to half-open state');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
      this.logger.info('Circuit breaker closed after successful operation');
      this.emit('closed');
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      this.logger.warn(`Circuit breaker opened after ${this.failures} failures`);
      this.emit('opened', { failures: this.failures });
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Compression utility for cache values
 */
class CompressionUtil {
  private static zlib = require('zlib');

  static async compress(data: any, algorithm: string, threshold: number): Promise<Buffer | string> {
    const serialized = JSON.stringify(data);
    const buffer = Buffer.from(serialized, 'utf8');

    if (buffer.length < threshold) {
      return serialized;
    }

    switch (algorithm) {
      case 'gzip':
        return this.zlib.gzipSync(buffer);
      case 'lz4':
        // Fallback to gzip if lz4 not available
        return this.zlib.gzipSync(buffer);
      case 'snappy':
        // Fallback to gzip if snappy not available
        return this.zlib.gzipSync(buffer);
      default:
        return serialized;
    }
  }

  static async decompress(data: Buffer | string, algorithm: string): Promise<any> {
    if (typeof data === 'string') {
      return JSON.parse(data);
    }

    let decompressed: Buffer;
    switch (algorithm) {
      case 'gzip':
        decompressed = this.zlib.gunzipSync(data);
        break;
      case 'lz4':
        decompressed = this.zlib.gunzipSync(data);
        break;
      case 'snappy':
        decompressed = this.zlib.gunzipSync(data);
        break;
      default:
        throw new Error(`Unknown compression algorithm: ${algorithm}`);
    }

    return JSON.parse(decompressed.toString('utf8'));
  }
}

/**
 * Batch operation manager
 */
class BatchManager extends EventEmitter {
  private batchQueue: Array<{
    operation: 'get' | 'set' | 'delete';
    key: string;
    value?: any;
    ttl?: number;
    resolve: (result: any) => void;
    reject: (error: Error) => void;
  }> = [];
  private flushTimer?: ReturnType<typeof setTimeout>;
  private logger: Logger;

  constructor(
    private config: OptimizationConfig['batching'],
    private executor: (operations: any[]) => Promise<any[]>
  ) {
    super();
    this.logger = new Logger('BatchManager');
  }

  async addOperation(
    operation: 'get' | 'set' | 'delete',
    key: string,
    value?: any,
    ttl?: number
  ): Promise<any> {
    if (!this.config.enabled) {
      // Execute immediately if batching disabled
      return this.executor([{ operation, key, value, ttl }]).then(results => results[0]);
    }

    return new Promise((resolve, reject) => {
      this.batchQueue.push({ operation, key, value, ttl, resolve, reject });

      if (this.batchQueue.length >= this.config.batchSize) {
        this.flush();
      } else if (!this.flushTimer) {
        this.flushTimer = setTimeout(() => this.flush(), this.config.flushInterval);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    const operations = this.batchQueue.splice(0);
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    try {
      const results = await this.executor(operations);
      operations.forEach((op, index) => {
        op.resolve(results[index]);
      });
    } catch (error) {
      operations.forEach(op => {
        op.reject(error as Error);
      });
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    await this.flush();
  }
}

/**
 * Main Cache Optimizer
 */
export class CacheOptimizer extends EventEmitter {
  private connectionPool?: RedisConnectionPool;
  private circuitBreaker: CircuitBreaker;
  private batchManager?: BatchManager;
  private logger: Logger;
  private shutdownHandlers: Array<() => Promise<void>> = [];

  constructor(
    private config: OptimizationConfig,
    private redisConfig?: any
  ) {
    super();
    this.logger = new Logger('CacheOptimizer');
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize connection pool if Redis config provided
    if (this.redisConfig) {
      this.connectionPool = new RedisConnectionPool(
        this.config.connectionPool,
        this.redisConfig
      );
      this.shutdownHandlers.push(() => this.connectionPool!.destroy());
    }

    // Initialize batch manager
    if (this.config.batching.enabled) {
      this.batchManager = new BatchManager(
        this.config.batching,
        this.executeBatchOperations.bind(this)
      );
      this.shutdownHandlers.push(() => this.batchManager!.shutdown());
    }

    // Set up graceful shutdown
    this.setupGracefulShutdown();
  }

  async optimizedGet(key: string): Promise<any> {
    return this.circuitBreaker.execute(async () => {
      if (this.batchManager) {
        return this.batchManager.addOperation('get', key);
      }

      const connection = await this.getConnection();
      try {
        const result = await connection.get(key);
        if (result && this.config.compression.enabled) {
          return CompressionUtil.decompress(result, this.config.compression.algorithm);
        }
        return result;
      } finally {
        this.releaseConnection(connection);
      }
    });
  }

  async optimizedSet(key: string, value: any, ttl?: number): Promise<boolean> {
    return this.circuitBreaker.execute(async () => {
      let processedValue = value;

      if (this.config.compression.enabled) {
        processedValue = await CompressionUtil.compress(
          value,
          this.config.compression.algorithm,
          this.config.compression.threshold
        );
      }

      if (this.batchManager) {
        return this.batchManager.addOperation('set', key, processedValue, ttl);
      }

      const connection = await this.getConnection();
      try {
        return await connection.set(key, processedValue, ttl);
      } finally {
        this.releaseConnection(connection);
      }
    });
  }

  async optimizedDelete(key: string): Promise<boolean> {
    return this.circuitBreaker.execute(async () => {
      if (this.batchManager) {
        return this.batchManager.addOperation('delete', key);
      }

      const connection = await this.getConnection();
      try {
        return await connection.delete(key);
      } finally {
        this.releaseConnection(connection);
      }
    });
  }

  private async getConnection(): Promise<RedisService> {
    if (!this.connectionPool) {
      throw new Error('Connection pool not initialized');
    }
    return this.connectionPool.acquire();
  }

  private releaseConnection(connection: RedisService): void {
    if (this.connectionPool) {
      this.connectionPool.release(connection);
    }
  }

  private async executeBatchOperations(operations: any[]): Promise<any[]> {
    const connection = await this.getConnection();
    try {
      const results: any[] = [];

      for (const op of operations) {
        switch (op.operation) {
          case 'get':
            const getResult = await connection.get(op.key);
            results.push(getResult);
            break;
          case 'set':
            const setResult = await connection.set(op.key, op.value, op.ttl);
            results.push(setResult);
            break;
          case 'delete':
            const deleteResult = await connection.delete(op.key);
            results.push(deleteResult);
            break;
          default:
            results.push(null);
        }
      }

      return results;
    } finally {
      this.releaseConnection(connection);
    }
  }

  async warmupConnections(): Promise<void> {
    if (!this.connectionPool) {
      return;
    }

    this.logger.info('Warming up connection pool...');

    const connections: RedisService[] = [];
    try {
      // Acquire all minimum connections
      for (let i = 0; i < this.config.connectionPool.min; i++) {
        const connection = await this.connectionPool.acquire();
        connections.push(connection);

        // Perform a simple operation to warm up
        await connection.get('warmup:test');
      }

      this.logger.info(`Warmed up ${connections.length} connections`);
    } finally {
      // Release all connections
      connections.forEach(connection => {
        this.connectionPool!.release(connection);
      });
    }
  }

  getOptimizationStats(): {
    connectionPool?: any;
    circuitBreaker: any;
    batching?: any;
  } {
    return {
      connectionPool: this.connectionPool?.getStats(),
      circuitBreaker: this.circuitBreaker.getState(),
      batching: this.batchManager ? { enabled: true } : { enabled: false }
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (this.connectionPool) {
        const connection = await this.connectionPool.acquire();
        await connection.get('health:check');
        this.connectionPool.release(connection);
      }
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down optimizer...`);
      await this.shutdown();
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down cache optimizer...');

    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        this.logger.error('Error during shutdown:', error);
      }
    }

    this.logger.info('Cache optimizer shutdown completed');
  }
}

/**
 * Default optimization configuration
 */
export function createDefaultOptimizationConfig(): OptimizationConfig {
  return {
    connectionPool: {
      min: parseInt(process.env.REDIS_POOL_MIN || '2'),
      max: parseInt(process.env.REDIS_POOL_MAX || '10'),
      acquireTimeoutMillis: parseInt(process.env.REDIS_POOL_ACQUIRE_TIMEOUT || '30000'),
      createTimeoutMillis: parseInt(process.env.REDIS_POOL_CREATE_TIMEOUT || '30000'),
      destroyTimeoutMillis: parseInt(process.env.REDIS_POOL_DESTROY_TIMEOUT || '5000'),
      idleTimeoutMillis: parseInt(process.env.REDIS_POOL_IDLE_TIMEOUT || '300000'),
      reapIntervalMillis: parseInt(process.env.REDIS_POOL_REAP_INTERVAL || '60000'),
      createRetryIntervalMillis: parseInt(process.env.REDIS_POOL_RETRY_INTERVAL || '1000'),
      propagateCreateError: process.env.REDIS_POOL_PROPAGATE_ERROR !== 'false'
    },
    lazyLoading: {
      enabled: process.env.CACHE_LAZY_LOADING !== 'false',
      preloadThreshold: parseInt(process.env.CACHE_PRELOAD_THRESHOLD || '10'),
      maxPreloadSize: parseInt(process.env.CACHE_MAX_PRELOAD_SIZE || '100')
    },
    compression: {
      enabled: process.env.CACHE_COMPRESSION_ENABLED !== 'false',
      threshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024'),
      algorithm: (process.env.CACHE_COMPRESSION_ALGORITHM as any) || 'gzip'
    },
    batching: {
      enabled: process.env.CACHE_BATCHING_ENABLED !== 'false',
      batchSize: parseInt(process.env.CACHE_BATCH_SIZE || '50'),
      flushInterval: parseInt(process.env.CACHE_BATCH_FLUSH_INTERVAL || '100')
    },
    circuitBreaker: {
      enabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
      failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
      recoveryTime: parseInt(process.env.CIRCUIT_BREAKER_RECOVERY_TIME || '30000'),
      monitoringPeriod: parseInt(process.env.CIRCUIT_BREAKER_MONITORING_PERIOD || '60000')
    }
  };
}