/**
 * Memory Service Integration
 * Provides easy integration of MemoryManager with ServiceManager
 */

import { MemoryManager, MemoryConfig } from './MemoryManager';
import { ServiceManager } from '../services/ServiceManager';

export interface MemoryServiceConfig extends Partial<MemoryConfig> {
  autoRegister?: boolean;
  enableGlobalAccess?: boolean;
}

export class MemoryService {
  private memoryManager: MemoryManager;
  private serviceManager?: ServiceManager;

  constructor(config: MemoryServiceConfig = {}) {
    this.memoryManager = new MemoryManager(config);
  }

  /**
   * Register the MemoryManager with the ServiceManager
   */
  registerWithServiceManager(serviceManager: ServiceManager): void {
    this.serviceManager = serviceManager;
    serviceManager.registerService(this.memoryManager);
  }

  /**
   * Get the MemoryManager instance
   */
  getMemoryManager(): MemoryManager {
    return this.memoryManager;
  }

  /**
   * Get direct access to the connection pool
   */
  getConnectionPool() {
    return this.memoryManager.getConnectionPool();
  }

  /**
   * Get direct access to the cache manager
   */
  getCacheManager() {
    return this.memoryManager.getCacheManager();
  }

  /**
   * Setup memory monitoring with custom thresholds
   */
  async setupMonitoring(thresholds?: {
    warning?: number;
    critical?: number;
    cleanup?: number;
  }): Promise<void> {
    if (!this.memoryManager) return;

    // Setup event listeners for memory events
    this.memoryManager.on('memory:warning', (report) => {
      console.warn(`Memory warning: ${(report.metrics.heapUsed / 1024 / 1024).toFixed(0)}MB used`);
      
      if (this.serviceManager) {
        this.serviceManager.emit('system:memory-warning', report);
      }
    });

    this.memoryManager.on('memory:critical', (report) => {
      console.error(`Critical memory usage: ${(report.metrics.heapUsed / 1024 / 1024).toFixed(0)}MB used`);
      
      if (this.serviceManager) {
        this.serviceManager.emit('system:memory-critical', report);
      }
    });

    this.memoryManager.on('memory:leaks-detected', (leaks) => {
      console.warn(`Memory leaks detected: ${leaks.length} potential leaks`);
      
      if (this.serviceManager) {
        this.serviceManager.emit('system:memory-leaks', leaks);
      }
    });
  }

  /**
   * Create a database connection using the connection pool
   */
  async createDatabaseConnection(config?: import('./ConnectionPool').ConnectionConfig) {
    const pool = this.memoryManager.getConnectionPool();
    return pool.getConnection(config);
  }

  /**
   * Execute a database query using the connection pool
   */
  async executeQuery<T = any>(
    query: string, 
    params: any[] = [], 
    config?: import('./ConnectionPool').ConnectionConfig
  ): Promise<T> {
    const pool = this.memoryManager.getConnectionPool();
    return pool.executeQuery<T>(query, params, config);
  }

  /**
   * Cache a value using the cache manager
   */
  async cacheSet<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    const cache = this.memoryManager.getCacheManager();
    return cache.set(key, value, ttl);
  }

  /**
   * Retrieve a cached value
   */
  async cacheGet<T = any>(key: string): Promise<T | null> {
    const cache = this.memoryManager.getCacheManager();
    return cache.get<T>(key);
  }

  /**
   * Get comprehensive memory report
   */
  async getMemoryReport() {
    return this.memoryManager.getMemoryReport();
  }

  /**
   * Force memory cleanup
   */
  async forceCleanup(): Promise<void> {
    return this.memoryManager.performCleanup();
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    const memoryHealth = await this.memoryManager.healthCheck();
    const poolHealth = this.memoryManager.getConnectionPool().getHealth();
    const cacheHealth = await this.memoryManager.getCacheManager().getHealth();

    return {
      overall: memoryHealth.healthy && poolHealth.healthy && cacheHealth.healthy,
      memory: memoryHealth,
      connectionPool: poolHealth,
      cache: cacheHealth
    };
  }
}

/**
 * Factory function to create and configure MemoryService
 */
export function createMemoryService(config: MemoryServiceConfig = {}): MemoryService {
  return new MemoryService(config);
}

/**
 * Utility to register memory service with an existing ServiceManager
 */
export function registerMemoryService(
  serviceManager: ServiceManager, 
  config: MemoryServiceConfig = {}
): MemoryService {
  const memoryService = createMemoryService(config);
  memoryService.registerWithServiceManager(serviceManager);
  return memoryService;
}

// Global singleton for easy access
let globalMemoryService: MemoryService | null = null;

/**
 * Get or create global MemoryService instance
 */
export function getGlobalMemoryService(config?: MemoryServiceConfig): MemoryService {
  if (!globalMemoryService) {
    globalMemoryService = createMemoryService(config);
  }
  return globalMemoryService;
}

/**
 * Reset global MemoryService instance
 */
export function resetGlobalMemoryService(): void {
  globalMemoryService = null;
}