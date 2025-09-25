/**
 * Memory Management System Exports
 * Complete memory management solution for Electron main process
 */

// Main components
export { MemoryManager } from './MemoryManager';
export { ConnectionPool } from './ConnectionPool';
export { CacheManager } from './CacheManager';

// Types and interfaces
export type {
  MemoryMetrics,
  MemoryThresholds,
  MemoryConfig,
  MemoryReport,
  MemoryLeak,
} from './MemoryManager';

export type {
  ConnectionConfig,
  PoolConfig,
  Connection,
  PoolMetrics,
  PoolHealth,
} from './ConnectionPool';

export type { CacheEntry, CacheConfig, CacheMetrics, CacheHealth } from './CacheManager';

// Default instances and factory functions
import { MemoryManager } from './MemoryManager';
import { ConnectionPool } from './ConnectionPool';
import { CacheManager } from './CacheManager';

let memoryManagerInstance: MemoryManager | null = null;

export function createMemoryManager(
  config?: Partial<import('./MemoryManager').MemoryConfig>
): MemoryManager {
  return new MemoryManager(config);
}

export function getMemoryManager(
  config?: Partial<import('./MemoryManager').MemoryConfig>
): MemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = createMemoryManager(config);
  }
  return memoryManagerInstance;
}

export function resetMemoryManager(): void {
  memoryManagerInstance = null;
}

export function createConnectionPool(
  config?: Partial<import('./ConnectionPool').PoolConfig>
): ConnectionPool {
  return new ConnectionPool(config);
}

export function createCacheManager(
  config?: Partial<import('./CacheManager').CacheConfig>
): CacheManager {
  return new CacheManager(config);
}
