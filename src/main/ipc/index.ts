/**
 * Enhanced IPC Communication System
 *
 * This module provides an optimized IPC system for Electron applications with:
 * - Request batching for bulk operations
 * - Response streaming for large datasets
 * - Response caching with TTL support
 * - Type-safe handlers with validation
 * - Comprehensive performance monitoring
 */

// Core IPC components
export { IPCManager } from './IPCManager';
export { RequestBatcher } from './RequestBatcher';
export { StreamingHandler } from './StreamingHandler';

// Handler registry
export { IPCHandlers } from './handlers';

// Integration utilities
export {
  IPCIntegration,
  initializeEnhancedIPC,
  registerCustomHandler,
} from './example-integration';

// Type definitions
export type {
  IPCRequest,
  IPCResponse,
  IPCHandler,
  IPCHandlerConfig,
  IPCMetrics,
} from './IPCManager';

export type { BatchRequest, BatchConfig, BatchMetrics } from './RequestBatcher';

export type { StreamConfig, StreamMetrics, StreamProgress, StreamChunk } from './StreamingHandler';

// Re-export preload types for renderer usage
export type {
  IPCResponse as PreloadIPCResponse,
  StreamChunk as PreloadStreamChunk,
  ElectronAPI,
} from '../preload';

/**
 * Default configuration for IPC system
 */
export const DEFAULT_IPC_CONFIG = {
  // Request batching defaults
  batching: {
    maxBatchSize: 50,
    maxDelayMs: 100,
    maxConcurrentBatches: 10,
  },

  // Streaming defaults
  streaming: {
    chunkSize: 1000,
    maxBufferSize: 10000,
    timeoutMs: 30000,
    enableBackpressure: true,
  },

  // Caching defaults
  caching: {
    defaultTTL: 300000, // 5 minutes
    maxCacheSize: 1000,
  },

  // Rate limiting defaults
  rateLimiting: {
    defaultRequests: 100,
    defaultWindow: 60000, // 1 minute
  },
} as const;

/**
 * Performance optimization presets
 */
export const PERFORMANCE_PRESETS = {
  // For high-frequency, simple operations
  HIGH_FREQUENCY: {
    batchable: true,
    batchSize: 50,
    batchDelay: 25,
    cacheable: true,
    cacheTTL: 60000, // 1 minute
    rateLimit: { requests: 200, window: 60000 },
  },

  // For medium-frequency operations with moderate complexity
  MEDIUM_FREQUENCY: {
    batchable: true,
    batchSize: 20,
    batchDelay: 100,
    cacheable: true,
    cacheTTL: 300000, // 5 minutes
    rateLimit: { requests: 100, window: 60000 },
  },

  // For low-frequency, expensive operations
  LOW_FREQUENCY: {
    batchable: false,
    cacheable: true,
    cacheTTL: 1800000, // 30 minutes
    rateLimit: { requests: 20, window: 60000 },
  },

  // For large dataset operations
  STREAMING: {
    streamable: true,
    streamChunkSize: 1000,
    cacheable: false,
    rateLimit: { requests: 10, window: 60000 },
  },

  // For real-time operations
  REAL_TIME: {
    batchable: false,
    cacheable: false,
    rateLimit: { requests: 500, window: 60000 },
  },
} as const;

/**
 * Validation helpers for common patterns
 */
export const VALIDATION_HELPERS = {
  // String validation
  nonEmptyString: (args: any[]) => {
    return args[0] && typeof args[0] === 'string' && args[0].trim().length > 0
      ? true
      : 'Must provide a non-empty string';
  },

  // ID validation (alphanumeric with hyphens/underscores)
  validId: (args: any[]) => {
    return args[0] && typeof args[0] === 'string' && /^[a-zA-Z0-9-_]+$/.test(args[0])
      ? true
      : 'ID must contain only alphanumeric characters, hyphens, and underscores';
  },

  // Object validation
  requiredObject: (args: any[]) => {
    return args[0] && typeof args[0] === 'object' && args[0] !== null
      ? true
      : 'Must provide a valid object';
  },

  // Number validation
  positiveNumber: (args: any[]) => {
    return args[0] && typeof args[0] === 'number' && args[0] > 0
      ? true
      : 'Must provide a positive number';
  },

  // Boolean validation
  validBoolean: (args: any[]) => {
    return typeof args[0] === 'boolean' ? true : 'Must provide a boolean value';
  },

  // Array validation
  nonEmptyArray: (args: any[]) => {
    return Array.isArray(args[0]) && args[0].length > 0 ? true : 'Must provide a non-empty array';
  },

  // Composite validation for search operations
  searchQuery: (args: any[]) => {
    if (!args[0] || typeof args[0] !== 'string') {
      return 'Search query must be a string';
    }
    if (args[0].trim().length === 0) {
      return 'Search query cannot be empty';
    }
    if (args[0].length > 1000) {
      return 'Search query too long (max 1000 characters)';
    }
    return true;
  },
} as const;

/**
 * Error codes used by the IPC system
 */
export const IPC_ERROR_CODES = {
  // General errors
  HANDLER_NOT_FOUND: 'IPC_HANDLER_NOT_FOUND',
  HANDLER_ERROR: 'IPC_HANDLER_ERROR',
  VALIDATION_FAILED: 'IPC_VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED: 'IPC_RATE_LIMIT_EXCEEDED',
  UNHANDLED_REJECTION: 'IPC_UNHANDLED_REJECTION',

  // Batching errors
  BATCH_MAX_CONCURRENT: 'BATCH_MAX_CONCURRENT',
  BATCH_DESTROYED: 'BATCH_DESTROYED',

  // Streaming errors
  STREAM_NO_DATA: 'STREAM_NO_DATA',
  STREAM_TIMEOUT: 'STREAM_TIMEOUT',
  STREAM_CANCELLED: 'STREAM_CANCELLED',

  // Cache errors
  CACHE_ERROR: 'CACHE_ERROR',
  CACHE_INVALIDATION_ERROR: 'CACHE_INVALIDATION_ERROR',
} as const;

/**
 * Utility function to create a basic IPC handler configuration
 */
export function createHandlerConfig(
  preset: keyof typeof PERFORMANCE_PRESETS,
  overrides: Partial<IPCHandlerConfig> = {}
): IPCHandlerConfig {
  return {
    ...PERFORMANCE_PRESETS[preset],
    ...overrides,
  };
}

/**
 * Utility function to create validation chains
 */
export function createValidationChain(
  ...validators: Array<(args: any[]) => boolean | string>
): (args: any[]) => boolean | string {
  return (args: any[]) => {
    for (const validator of validators) {
      const result = validator(args);
      if (result !== true) {
        return result;
      }
    }
    return true;
  };
}

/**
 * Utility function to measure IPC performance
 */
export class IPCPerformanceMonitor {
  private metrics = new Map<
    string,
    {
      totalCalls: number;
      totalTime: number;
      averageTime: number;
      minTime: number;
      maxTime: number;
      errorCount: number;
    }
  >();

  recordCall(channel: string, executionTime: number, success: boolean): void {
    const existing = this.metrics.get(channel) || {
      totalCalls: 0,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errorCount: 0,
    };

    existing.totalCalls++;
    existing.totalTime += executionTime;
    existing.averageTime = existing.totalTime / existing.totalCalls;
    existing.minTime = Math.min(existing.minTime, executionTime);
    existing.maxTime = Math.max(existing.maxTime, executionTime);

    if (!success) {
      existing.errorCount++;
    }

    this.metrics.set(channel, existing);
  }

  getMetrics(channel?: string) {
    if (channel) {
      return this.metrics.get(channel);
    }
    return Object.fromEntries(this.metrics.entries());
  }

  reset(channel?: string): void {
    if (channel) {
      this.metrics.delete(channel);
    } else {
      this.metrics.clear();
    }
  }

  getTopSlowest(limit: number = 10) {
    return Array.from(this.metrics.entries())
      .sort(([, a], [, b]) => b.averageTime - a.averageTime)
      .slice(0, limit)
      .map(([channel, metrics]) => ({ channel, ...metrics }));
  }

  getTopErrors(limit: number = 10) {
    return Array.from(this.metrics.entries())
      .sort(([, a], [, b]) => b.errorCount - a.errorCount)
      .slice(0, limit)
      .map(([channel, metrics]) => ({ channel, ...metrics }));
  }
}

// Export a default instance for convenience
export const ipcPerformanceMonitor = new IPCPerformanceMonitor();
