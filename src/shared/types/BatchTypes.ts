/**
 * Batch IPC Types and Protocol
 *
 * Defines types for batched IPC communication to reduce
 * round-trip latency and improve dashboard loading performance.
 */

export interface BatchRequest {
  id: string;
  method: string;
  params?: any[];
  priority?: 'low' | 'medium' | 'high';
  timeout?: number;
  cacheable?: boolean;
  category?: string; // For grouping related requests
}

export interface BatchResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    cached?: boolean;
    executionTime?: number;
    fromBatch?: boolean;
  };
}

export interface BatchRequestPayload {
  requests: BatchRequest[];
  batchId: string;
  timestamp: number;
  maxWaitTime?: number; // Maximum time to wait for more requests
  priority?: 'low' | 'medium' | 'high';
  metadata?: {
    source?: string; // e.g., 'dashboard', 'search', 'metrics'
    version?: string;
    retryCount?: number;
  };
}

export interface BatchResponsePayload {
  responses: BatchResponse[];
  batchId: string;
  timestamp: number;
  metadata: {
    totalExecutionTime: number;
    cacheHits: number;
    errors: number;
    processed: number;
  };
}

// Pre-defined batch configurations for common use cases
export interface BatchConfig {
  name: string;
  description: string;
  maxBatchSize: number;
  maxWaitTime: number;
  priority: 'low' | 'medium' | 'high';
  requests: Array<{
    method: string;
    description: string;
    cacheable: boolean;
    timeout: number;
  }>;
}

// Dashboard batch - the main optimization target
export const DASHBOARD_BATCH_CONFIG: BatchConfig = {
  name: 'dashboard-load',
  description: 'Batch all dashboard loading requests into single IPC call',
  maxBatchSize: 10,
  maxWaitTime: 100, // 100ms window
  priority: 'high',
  requests: [
    {
      method: 'system:get-metrics',
      description: 'Database metrics',
      cacheable: true,
      timeout: 1000,
    },
    {
      method: 'system:get-performance-metrics',
      description: 'Performance metrics',
      cacheable: true,
      timeout: 1000,
    },
    {
      method: 'system:get-health-status',
      description: 'System health',
      cacheable: true,
      timeout: 500,
    },
    {
      method: 'kb:get-stats',
      description: 'KB statistics',
      cacheable: true,
      timeout: 800,
    },
    {
      method: 'search:get-recent-queries',
      description: 'Recent search queries',
      cacheable: true,
      timeout: 300,
    },
    {
      method: 'system:get-storage-info',
      description: 'Storage information',
      cacheable: true,
      timeout: 200,
    },
  ],
};

// Search batch configuration
export const SEARCH_BATCH_CONFIG: BatchConfig = {
  name: 'search-operations',
  description: 'Batch search-related requests',
  maxBatchSize: 5,
  maxWaitTime: 50, // Faster for search
  priority: 'high',
  requests: [
    {
      method: 'search:execute',
      description: 'Execute search query',
      cacheable: true,
      timeout: 2000,
    },
    {
      method: 'search:get-suggestions',
      description: 'Get search suggestions',
      cacheable: true,
      timeout: 500,
    },
    {
      method: 'search:record-query',
      description: 'Record search query',
      cacheable: false,
      timeout: 100,
    },
  ],
};

// Batch error types
export enum BatchError {
  BATCH_TIMEOUT = 'BATCH_TIMEOUT',
  BATCH_TOO_LARGE = 'BATCH_TOO_LARGE',
  INVALID_REQUEST = 'INVALID_REQUEST',
  PARTIAL_FAILURE = 'PARTIAL_FAILURE',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  HANDLER_NOT_FOUND = 'HANDLER_NOT_FOUND',
}

export interface BatchStats {
  totalBatches: number;
  totalRequests: number;
  averageBatchSize: number;
  averageExecutionTime: number;
  cacheHitRate: number;
  errorRate: number;
  timesSaved: number; // Estimated time saved vs individual requests
}

// Utility types for type safety
export type BatchableMethod =
  | 'system:get-metrics'
  | 'system:get-performance-metrics'
  | 'system:get-health-status'
  | 'kb:get-stats'
  | 'search:get-recent-queries'
  | 'system:get-storage-info'
  | 'search:execute'
  | 'search:get-suggestions'
  | 'search:record-query'
  | 'kb:get-entries'
  | 'kb:get-popular'
  | 'kb:get-recent';

export interface BatchContext {
  source: string;
  user?: string;
  sessionId?: string;
  startTime: number;
}
