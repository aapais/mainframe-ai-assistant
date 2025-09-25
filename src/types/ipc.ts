/**
 * Comprehensive IPC Type Definitions
 *
 * This file contains all TypeScript interfaces and types for secure,
 * type-safe IPC communication between main and renderer processes.
 */

import { z } from 'zod';
import type {
  KBEntry,
  KBEntryInput,
  KBEntryUpdate,
  SearchResult,
  SearchQuery,
  KBCategory,
} from './index';

// ===========================
// Core IPC Types
// ===========================

/**
 * Base interface for all IPC requests
 */
export interface BaseIPCRequest {
  readonly requestId: string;
  readonly timestamp: number;
  readonly channel: string;
  readonly version: string; // API version for compatibility
  readonly userId?: string; // Optional user context
}

/**
 * Base interface for all IPC responses
 */
export interface BaseIPCResponse<T = any> {
  readonly success: boolean;
  readonly requestId: string;
  readonly timestamp: number;
  readonly executionTime: number;
  readonly data?: T;
  readonly error?: IPCError;
  readonly metadata?: ResponseMetadata;
}

/**
 * IPC Error structure with detailed information
 */
export interface IPCError {
  readonly code: IPCErrorCode;
  readonly message: string;
  readonly details?: Record<string, any>;
  readonly stack?: string; // Only included in development mode
  readonly retryable?: boolean; // Whether the operation can be retried
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Response metadata for debugging and optimization
 */
export interface ResponseMetadata {
  readonly cached: boolean;
  readonly batched: boolean;
  readonly streamed: boolean;
  readonly fromCache?: string; // Cache layer identifier
  readonly cacheHitRate?: number;
  readonly batchSize?: number;
  readonly performanceMetrics?: PerformanceMetrics;
}

/**
 * Performance metrics for individual operations
 */
export interface PerformanceMetrics {
  readonly dbQueryTime?: number;
  readonly serializationTime?: number;
  readonly networkTime?: number;
  readonly cacheTime?: number;
  readonly validationTime?: number;
  readonly totalTime: number;
}

// ===========================
// Channel Definitions
// ===========================

/**
 * All available IPC channels with type constraints
 */
export type IPCChannel =
  // Knowledge Base Operations
  | 'kb:search:local'
  | 'kb:search:ai'
  | 'kb:entry:create'
  | 'kb:entry:get'
  | 'kb:entry:update'
  | 'kb:entry:delete'
  | 'kb:feedback:rate'
  | 'kb:templates:load'

  // System Operations
  | 'system:metrics:get'
  | 'system:database:status'
  | 'system:cache:invalidate'
  | 'system:health:check'
  | 'system:performance:report'

  // Import/Export Operations (MVP4)
  | 'io:export:kb'
  | 'io:import:kb'
  | 'io:project:import'
  | 'io:project:export'

  // Pattern Detection Operations (MVP2)
  | 'patterns:detect:run'
  | 'patterns:incidents:import'
  | 'patterns:alerts:get'
  | 'patterns:rootcause:analyze'

  // Window Management
  | 'window:state:get'
  | 'window:state:update'
  | 'window:control:minimize'
  | 'window:control:maximize'
  | 'window:control:restore'
  | 'window:control:close'

  // Application Lifecycle
  | 'app:version:get'
  | 'app:theme:get'
  | 'app:theme:set'
  | 'app:close'
  | 'app:restart'

  // Authorization Operations
  | 'authorization:request'
  | 'authorization:save_decision'
  | 'authorization:get_preferences'
  | 'authorization:update_preferences'
  | 'authorization:estimate_cost'
  | 'authorization:check_auto_approval'
  | 'authorization:get_stats'
  | 'authorization:clear_session'

  // Development Tools
  | 'dev:tools:open'
  | 'dev:logs:get'
  | 'dev:cache:clear'
  | 'dev:database:reset';

/**
 * Error codes for different types of IPC failures
 */
export enum IPCErrorCode {
  // Client Errors (4xx equivalent)
  INVALID_CHANNEL = 'IPC_INVALID_CHANNEL',
  VALIDATION_FAILED = 'IPC_VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'IPC_RATE_LIMIT_EXCEEDED',
  MALICIOUS_INPUT = 'IPC_MALICIOUS_INPUT',
  INSUFFICIENT_PERMISSIONS = 'IPC_INSUFFICIENT_PERMISSIONS',
  INVALID_REQUEST_FORMAT = 'IPC_INVALID_REQUEST_FORMAT',

  // Server Errors (5xx equivalent)
  HANDLER_NOT_FOUND = 'IPC_HANDLER_NOT_FOUND',
  HANDLER_ERROR = 'IPC_HANDLER_ERROR',
  DATABASE_ERROR = 'IPC_DATABASE_ERROR',
  CACHE_ERROR = 'IPC_CACHE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'IPC_EXTERNAL_SERVICE_ERROR',

  // System Errors
  UNHANDLED_REJECTION = 'IPC_UNHANDLED_REJECTION',
  TIMEOUT = 'IPC_TIMEOUT',
  MEMORY_ERROR = 'IPC_MEMORY_ERROR',
  NETWORK_ERROR = 'IPC_NETWORK_ERROR',

  // Business Logic Errors
  ENTRY_NOT_FOUND = 'KB_ENTRY_NOT_FOUND',
  DUPLICATE_ENTRY = 'KB_DUPLICATE_ENTRY',
  INVALID_SEARCH_QUERY = 'KB_INVALID_SEARCH_QUERY',
  TEMPLATE_LOAD_FAILED = 'KB_TEMPLATE_LOAD_FAILED',

  // Pattern Detection Errors
  PATTERN_DETECTION_FAILED = 'PATTERNS_DETECTION_FAILED',
  INCIDENT_IMPORT_FAILED = 'PATTERNS_INCIDENT_IMPORT_FAILED',

  // Import/Export Errors
  EXPORT_FAILED = 'IO_EXPORT_FAILED',
  IMPORT_FAILED = 'IO_IMPORT_FAILED',
  FILE_NOT_FOUND = 'IO_FILE_NOT_FOUND',
  PERMISSION_DENIED = 'IO_PERMISSION_DENIED',

  // Authorization Errors
  AUTHORIZATION_FAILED = 'AUTH_AUTHORIZATION_FAILED',
  SAVE_FAILED = 'AUTH_SAVE_FAILED',
  UPDATE_FAILED = 'AUTH_UPDATE_FAILED',
  COST_ESTIMATION_FAILED = 'AUTH_COST_ESTIMATION_FAILED',
  AUTO_APPROVAL_CHECK_FAILED = 'AUTH_AUTO_APPROVAL_CHECK_FAILED',
  STATS_RETRIEVAL_FAILED = 'AUTH_STATS_RETRIEVAL_FAILED',
  SESSION_CLEAR_FAILED = 'AUTH_SESSION_CLEAR_FAILED',
  INVALID_REQUEST_DATA = 'AUTH_INVALID_REQUEST_DATA',
}

// ===========================
// Knowledge Base Operation Types
// ===========================

/**
 * Search request with comprehensive options
 */
export interface KBSearchRequest extends BaseIPCRequest {
  channel: 'kb:search:local' | 'kb:search:ai';
  query: string;
  options?: {
    limit?: number;
    offset?: number;
    categories?: Array<'JCL' | 'VSAM' | 'DB2' | 'Batch' | 'Functional' | 'Other'>;
    tags?: string[];
    includeArchived?: boolean;
    sortBy?: 'relevance' | 'date' | 'usage' | 'rating';
    sortOrder?: 'asc' | 'desc';
    minConfidence?: number; // For AI search
    useSemanticSearch?: boolean;
  };
}

export interface KBSearchResponse extends BaseIPCResponse<SearchResult[]> {
  data: SearchResult[];
  metadata: ResponseMetadata & {
    totalResults: number;
    searchType: 'exact' | 'fuzzy' | 'semantic';
    aiConfidence?: number;
    queryProcessingTime: number;
    hasMoreResults: boolean;
  };
}

/**
 * Entry creation request
 */
export interface KBEntryCreateRequest extends BaseIPCRequest {
  channel: 'kb:entry:create';
  entry: KBEntryInput;
  options?: {
    validate?: boolean;
    duplicateCheck?: boolean;
    autoTags?: boolean; // Generate tags automatically
    notifyUsers?: boolean; // Notify other users of new entry
  };
}

export interface KBEntryCreateResponse extends BaseIPCResponse<string> {
  data: string; // Created entry ID
  metadata: ResponseMetadata & {
    duplicatesFound?: number;
    autoGeneratedTags?: string[];
    validationPassed: boolean;
  };
}

/**
 * Entry retrieval request
 */
export interface KBEntryGetRequest extends BaseIPCRequest {
  channel: 'kb:entry:get';
  id: string;
  options?: {
    includeMetrics?: boolean;
    includeRevisions?: boolean;
    includeRelated?: boolean; // Include related entries
    markAsViewed?: boolean; // Track view for analytics
  };
}

export interface KBEntryGetResponse extends BaseIPCResponse<KBEntry | null> {
  data: KBEntry | null;
  metadata: ResponseMetadata & {
    relatedEntries?: KBEntry[];
    viewCount?: number;
    lastModified?: number;
  };
}

/**
 * Entry update request
 */
export interface KBEntryUpdateRequest extends BaseIPCRequest {
  channel: 'kb:entry:update';
  id: string;
  updates: Partial<KBEntryInput>;
  options?: {
    validate?: boolean;
    createRevision?: boolean;
    notifyUsers?: boolean;
    reason?: string; // Reason for the update
  };
}

export interface KBEntryUpdateResponse extends BaseIPCResponse<void> {
  metadata: ResponseMetadata & {
    revisionId?: string;
    affectedUsers?: number;
    validationWarnings?: string[];
  };
}

/**
 * Entry deletion request
 */
export interface KBEntryDeleteRequest extends BaseIPCRequest {
  channel: 'kb:entry:delete';
  id: string;
  options?: {
    softDelete?: boolean; // Archive instead of permanent deletion
    reason?: string;
    transferReferences?: boolean; // Transfer references to similar entries
  };
}

/**
 * Feedback rating request
 */
export interface KBFeedbackRequest extends BaseIPCRequest {
  channel: 'kb:feedback:rate';
  entryId: string;
  rating: 'helpful' | 'not_helpful';
  comment?: string;
  context?: {
    searchQuery?: string;
    problemResolved?: boolean;
    timeToResolve?: number; // in minutes
  };
}

// ===========================
// System Operation Types
// ===========================

/**
 * System metrics request
 */
export interface SystemMetricsRequest extends BaseIPCRequest {
  channel: 'system:metrics:get';
  scope?: 'all' | 'database' | 'cache' | 'performance' | 'ipc';
  timeRange?: {
    start: number;
    end: number;
  };
  aggregation?: 'raw' | 'hourly' | 'daily';
}

export interface SystemMetricsResponse extends BaseIPCResponse<SystemMetrics> {
  data: SystemMetrics;
  metadata: ResponseMetadata & {
    metricsAge: number; // How old the metrics are
    nextUpdateIn: number; // When metrics will be updated next
  };
}

export interface SystemMetrics {
  database: {
    totalEntries: number;
    totalSearches: number;
    averageQueryTime: number;
    connectionPoolStatus: {
      active: number;
      idle: number;
      max: number;
    };
    cacheHitRate: number;
    diskUsage: {
      used: number;
      available: number;
      percentage: number;
    };
  };

  ipc: {
    totalRequests: number;
    totalResponses: number;
    totalErrors: number;
    averageResponseTime: number;
    errorRate: number;
    channelMetrics: Record<string, ChannelMetrics>;
  };

  cache: {
    memoryUsage: number;
    hitRate: number;
    missRate: number;
    evictionRate: number;
    totalKeys: number;
  };

  performance: {
    cpuUsage: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    uptime: number;
    responseTimePercentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
}

/**
 * Database status request
 */
export interface DatabaseStatusRequest extends BaseIPCRequest {
  channel: 'system:database:status';
  includeDetails?: boolean;
}

export interface DatabaseStatusResponse extends BaseIPCResponse<DatabaseStatus> {
  data: DatabaseStatus;
}

export interface DatabaseStatus {
  connected: boolean;
  healthy: boolean;
  version: string;
  totalEntries: number;
  lastBackup?: number;
  schemaVersion: string;
  integrityCheck: {
    passed: boolean;
    issues?: string[];
  };
  performance: {
    averageQueryTime: number;
    slowQueries: number;
    activeConnections: number;
    connectionPoolHealth: 'good' | 'warning' | 'critical';
  };
}

/**
 * Health check request
 */
export interface HealthCheckRequest extends BaseIPCRequest {
  channel: 'system:health:check';
  includeDetails?: boolean;
}

export interface HealthCheckResponse extends BaseIPCResponse<HealthStatus> {
  data: HealthStatus;
}

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    database: ComponentHealth;
    cache: ComponentHealth;
    ipc: ComponentHealth;
    fileSystem: ComponentHealth;
    externalServices: ComponentHealth;
  };
  recommendations?: string[];
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical';
  message?: string;
  metrics?: Record<string, number>;
  lastCheck: number;
}

// ===========================
// Pattern Detection Types (MVP2)
// ===========================

export interface PatternDetectionRequest extends BaseIPCRequest {
  channel: 'patterns:detect:run';
  options?: {
    timeWindow?: number; // in hours
    minIncidents?: number;
    categories?: string[];
    confidenceThreshold?: number;
  };
}

export interface PatternDetectionResponse extends BaseIPCResponse<Pattern[]> {
  data: Pattern[];
  metadata: ResponseMetadata & {
    totalIncidentsAnalyzed: number;
    patternsFound: number;
    analysisTime: number;
  };
}

export interface Pattern {
  id: string;
  type: 'temporal' | 'component' | 'error' | 'mixed';
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  incidents: Incident[];
  description: string;
  suggestedCause?: string;
  suggestedAction?: string;
  firstSeen: number;
  lastSeen: number;
  frequency: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface Incident {
  id: string;
  ticketId: string;
  timestamp: number;
  title: string;
  description: string;
  component?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolution?: string;
  resolutionTime?: number;
  kbEntryId?: string;
  category?: string;
}

// ===========================
// Streaming Types
// ===========================

export interface StreamRequest extends BaseIPCRequest {
  streamable: true;
  chunkSize?: number;
  maxChunks?: number;
  compression?: boolean;
}

export interface StreamResponse extends BaseIPCResponse {
  isStream: true;
  streamId: string;
  totalChunks: number;
  chunkIndex: number;
  isLastChunk: boolean;
}

export interface StreamChunk<T> {
  streamId: string;
  chunkIndex: number;
  data: T;
  isLastChunk: boolean;
  compressed?: boolean;
  metadata?: {
    progress: number; // 0-100%
    remainingChunks: number;
    estimatedTimeRemaining?: number; // in milliseconds
  };
}

// ===========================
// Batching Types
// ===========================

export interface BatchRequest extends BaseIPCRequest {
  batchable: true;
  batchId?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface BatchResponse extends BaseIPCResponse {
  isBatch: true;
  batchId: string;
  batchSize: number;
  individualResults: Array<{
    requestId: string;
    success: boolean;
    data?: any;
    error?: IPCError;
  }>;
}

// ===========================
// Caching Types
// ===========================

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  channel: string;
  size: number;
  compressed?: boolean;
  hits?: number;
  lastAccessed?: number;
}

export interface CacheStrategy {
  ttl: number;
  layer: 'memory' | 'persistent' | 'both';
  invalidateOn?: string[];
  keyGenerator: (args: any[]) => string;
  compressionThreshold?: number;
  maxSize?: number;
}

// ===========================
// Performance Types
// ===========================

export interface ChannelMetrics {
  totalRequests: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  successCount: number;
  errorCount: number;
  errorRate: number;
  p50ExecutionTime: number;
  p95ExecutionTime: number;
  p99ExecutionTime: number;
  throughputPerSecond: number;
  lastRequestTime: number;
}

export interface RealTimeMetrics {
  activeRequests: number;
  queuedRequests: number;
  errorRate: number;
  averageResponseTime: number;
  throughputPerSecond: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface PerformanceReport {
  timestamp: number;
  realTimeMetrics: RealTimeMetrics;
  channelReports: Array<
    {
      channel: string;
      healthScore: number;
    } & ChannelMetrics
  >;
  systemHealth: number; // 0-100
  recommendations: string[];
}

// ===========================
// Validation Schemas
// ===========================

/**
 * Zod schemas for runtime validation
 */
export const IPCSchemas = {
  // Base schemas
  BaseRequest: z.object({
    requestId: z.string().uuid(),
    timestamp: z.number().int().positive(),
    channel: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    userId: z.string().optional(),
  }),

  // Knowledge Base schemas
  KBSearch: z.object({
    query: z.string().min(1).max(1000),
    options: z
      .object({
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        categories: z
          .array(z.enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other']))
          .optional(),
        tags: z.array(z.string().max(50)).max(20).optional(),
        includeArchived: z.boolean().optional(),
        sortBy: z.enum(['relevance', 'date', 'usage', 'rating']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        minConfidence: z.number().min(0).max(1).optional(),
        useSemanticSearch: z.boolean().optional(),
      })
      .optional(),
  }),

  KBEntryCreate: z.object({
    entry: z.object({
      title: z.string().min(1).max(255),
      problem: z.string().min(1).max(10000),
      solution: z.string().min(1).max(10000),
      category: z.enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other']),
      tags: z.array(z.string().max(50)).max(20).optional(),
    }),
    options: z
      .object({
        validate: z.boolean().optional(),
        duplicateCheck: z.boolean().optional(),
        autoTags: z.boolean().optional(),
        notifyUsers: z.boolean().optional(),
      })
      .optional(),
  }),

  KBEntryUpdate: z.object({
    id: z.string().uuid(),
    updates: z.object({
      title: z.string().min(1).max(255).optional(),
      problem: z.string().min(1).max(10000).optional(),
      solution: z.string().min(1).max(10000).optional(),
      category: z.enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other']).optional(),
      tags: z.array(z.string().max(50)).max(20).optional(),
    }),
    options: z
      .object({
        validate: z.boolean().optional(),
        createRevision: z.boolean().optional(),
        notifyUsers: z.boolean().optional(),
        reason: z.string().max(500).optional(),
      })
      .optional(),
  }),

  // System schemas
  SystemMetrics: z.object({
    scope: z.enum(['all', 'database', 'cache', 'performance', 'ipc']).optional(),
    timeRange: z
      .object({
        start: z.number().int().positive(),
        end: z.number().int().positive(),
      })
      .optional(),
    aggregation: z.enum(['raw', 'hourly', 'daily']).optional(),
  }),

  // Pattern detection schemas
  PatternDetection: z.object({
    options: z
      .object({
        timeWindow: z.number().int().min(1).max(168).optional(), // 1 hour to 1 week
        minIncidents: z.number().int().min(2).max(100).optional(),
        categories: z.array(z.string()).optional(),
        confidenceThreshold: z.number().min(0).max(1).optional(),
      })
      .optional(),
  }),

  // General validation
  EntityId: z.object({
    id: z.string().uuid(),
  }),

  EntityIds: z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
  }),
} as const;

// ===========================
// Utility Types
// ===========================

/**
 * Extract the request type for a specific channel
 */
export type IPCRequestForChannel<T extends IPCChannel> = T extends
  | 'kb:search:local'
  | 'kb:search:ai'
  ? KBSearchRequest
  : T extends 'kb:entry:create'
    ? KBEntryCreateRequest
    : T extends 'kb:entry:get'
      ? KBEntryGetRequest
      : T extends 'kb:entry:update'
        ? KBEntryUpdateRequest
        : T extends 'kb:entry:delete'
          ? KBEntryDeleteRequest
          : T extends 'system:metrics:get'
            ? SystemMetricsRequest
            : T extends 'system:database:status'
              ? DatabaseStatusRequest
              : T extends 'system:health:check'
                ? HealthCheckRequest
                : T extends 'patterns:detect:run'
                  ? PatternDetectionRequest
                  : BaseIPCRequest;

/**
 * Extract the response type for a specific channel
 */
export type IPCResponseForChannel<T extends IPCChannel> = T extends
  | 'kb:search:local'
  | 'kb:search:ai'
  ? KBSearchResponse
  : T extends 'kb:entry:create'
    ? KBEntryCreateResponse
    : T extends 'kb:entry:get'
      ? KBEntryGetResponse
      : T extends 'kb:entry:update'
        ? KBEntryUpdateResponse
        : T extends 'system:metrics:get'
          ? SystemMetricsResponse
          : T extends 'system:database:status'
            ? DatabaseStatusResponse
            : T extends 'system:health:check'
              ? HealthCheckResponse
              : T extends 'patterns:detect:run'
                ? PatternDetectionResponse
                : BaseIPCResponse;

/**
 * Type-safe IPC handler function
 */
export type IPCHandlerFunction<T extends IPCChannel> = (
  request: IPCRequestForChannel<T>
) => Promise<IPCResponseForChannel<T>>;

/**
 * IPC handler configuration
 */
export interface IPCHandlerConfig {
  // Performance options
  batchable?: boolean;
  batchSize?: number;
  batchDelay?: number;
  streamable?: boolean;
  streamChunkSize?: number;

  // Caching options
  cacheable?: boolean;
  cacheTTL?: number;
  cacheStrategy?: Partial<CacheStrategy>;

  // Security options
  requireAuth?: boolean;
  allowedRoles?: string[];
  rateLimitConfig?: {
    requests: number;
    windowMs: number;
  };

  // Validation options
  validateInput?: boolean;
  sanitizeInput?: boolean;
  schema?: z.ZodSchema;

  // Monitoring options
  trackMetrics?: boolean;
  logRequests?: boolean;
  alertOnErrors?: boolean;
}

// ===========================
// Re-export from existing types
// ===========================

export type {
  KBEntry,
  KBEntryInput,
  KBEntryUpdate,
  SearchResult,
  SearchQuery,
  KBCategory,
} from './index';

// ===========================
// Event Types
// ===========================

/**
 * Events emitted by the IPC system
 */
export interface IPCEvents {
  'request:start': { channel: string; requestId: string };
  'request:complete': { channel: string; requestId: string; success: boolean; duration: number };
  error: { error: IPCError; channel: string; requestId: string };
  'cache:hit': { channel: string; key: string };
  'cache:miss': { channel: string; key: string };
  'cache:invalidate': { pattern: string; keysInvalidated: number };
  'batch:created': { batchId: string; size: number };
  'batch:executed': { batchId: string; success: boolean; duration: number };
  'stream:start': { streamId: string; channel: string };
  'stream:chunk': { streamId: string; chunkIndex: number };
  'stream:complete': { streamId: string; totalChunks: number };
  'metrics:updated': { timestamp: number; metrics: RealTimeMetrics };
}

/**
 * Type-safe event emitter interface
 */
export interface IPCEventEmitter {
  emit<K extends keyof IPCEvents>(event: K, data: IPCEvents[K]): boolean;
  on<K extends keyof IPCEvents>(event: K, listener: (data: IPCEvents[K]) => void): this;
  off<K extends keyof IPCEvents>(event: K, listener: (data: IPCEvents[K]) => void): this;
  once<K extends keyof IPCEvents>(event: K, listener: (data: IPCEvents[K]) => void): this;
}
