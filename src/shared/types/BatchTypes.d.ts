export interface BatchRequest {
  id: string;
  method: string;
  params?: any[];
  priority?: 'low' | 'medium' | 'high';
  timeout?: number;
  cacheable?: boolean;
  category?: string;
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
  maxWaitTime?: number;
  priority?: 'low' | 'medium' | 'high';
  metadata?: {
    source?: string;
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
export declare const DASHBOARD_BATCH_CONFIG: BatchConfig;
export declare const SEARCH_BATCH_CONFIG: BatchConfig;
export declare enum BatchError {
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
  timesSaved: number;
}
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
//# sourceMappingURL=BatchTypes.d.ts.map
