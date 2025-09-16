import { z } from 'zod';
export interface BaseIPCRequest {
    readonly requestId: string;
    readonly timestamp: number;
    readonly channel: string;
    readonly version: string;
    readonly userId?: string;
}
export interface BaseIPCResponse<T = any> {
    readonly success: boolean;
    readonly requestId: string;
    readonly timestamp: number;
    readonly executionTime: number;
    readonly data?: T;
    readonly error?: IPCError;
    readonly metadata?: ResponseMetadata;
}
export interface IPCError {
    readonly code: IPCErrorCode;
    readonly message: string;
    readonly details?: Record<string, any>;
    readonly stack?: string;
    readonly retryable?: boolean;
    readonly severity: 'low' | 'medium' | 'high' | 'critical';
}
export interface ResponseMetadata {
    readonly cached: boolean;
    readonly batched: boolean;
    readonly streamed: boolean;
    readonly fromCache?: string;
    readonly cacheHitRate?: number;
    readonly batchSize?: number;
    readonly performanceMetrics?: PerformanceMetrics;
}
export interface PerformanceMetrics {
    readonly dbQueryTime?: number;
    readonly serializationTime?: number;
    readonly networkTime?: number;
    readonly cacheTime?: number;
    readonly validationTime?: number;
    readonly totalTime: number;
}
export type IPCChannel = 'kb:search:local' | 'kb:search:ai' | 'kb:entry:create' | 'kb:entry:get' | 'kb:entry:update' | 'kb:entry:delete' | 'kb:feedback:rate' | 'kb:templates:load' | 'system:metrics:get' | 'system:database:status' | 'system:cache:invalidate' | 'system:health:check' | 'system:performance:report' | 'io:export:kb' | 'io:import:kb' | 'io:project:import' | 'io:project:export' | 'patterns:detect:run' | 'patterns:incidents:import' | 'patterns:alerts:get' | 'patterns:rootcause:analyze' | 'window:state:get' | 'window:state:update' | 'window:control:minimize' | 'window:control:maximize' | 'window:control:restore' | 'window:control:close' | 'app:version:get' | 'app:theme:get' | 'app:theme:set' | 'app:close' | 'app:restart' | 'authorization:request' | 'authorization:save_decision' | 'authorization:get_preferences' | 'authorization:update_preferences' | 'authorization:estimate_cost' | 'authorization:check_auto_approval' | 'authorization:get_stats' | 'authorization:clear_session' | 'dev:tools:open' | 'dev:logs:get' | 'dev:cache:clear' | 'dev:database:reset';
export declare enum IPCErrorCode {
    INVALID_CHANNEL = "IPC_INVALID_CHANNEL",
    VALIDATION_FAILED = "IPC_VALIDATION_FAILED",
    RATE_LIMIT_EXCEEDED = "IPC_RATE_LIMIT_EXCEEDED",
    MALICIOUS_INPUT = "IPC_MALICIOUS_INPUT",
    INSUFFICIENT_PERMISSIONS = "IPC_INSUFFICIENT_PERMISSIONS",
    INVALID_REQUEST_FORMAT = "IPC_INVALID_REQUEST_FORMAT",
    HANDLER_NOT_FOUND = "IPC_HANDLER_NOT_FOUND",
    HANDLER_ERROR = "IPC_HANDLER_ERROR",
    DATABASE_ERROR = "IPC_DATABASE_ERROR",
    CACHE_ERROR = "IPC_CACHE_ERROR",
    EXTERNAL_SERVICE_ERROR = "IPC_EXTERNAL_SERVICE_ERROR",
    UNHANDLED_REJECTION = "IPC_UNHANDLED_REJECTION",
    TIMEOUT = "IPC_TIMEOUT",
    MEMORY_ERROR = "IPC_MEMORY_ERROR",
    NETWORK_ERROR = "IPC_NETWORK_ERROR",
    ENTRY_NOT_FOUND = "KB_ENTRY_NOT_FOUND",
    DUPLICATE_ENTRY = "KB_DUPLICATE_ENTRY",
    INVALID_SEARCH_QUERY = "KB_INVALID_SEARCH_QUERY",
    TEMPLATE_LOAD_FAILED = "KB_TEMPLATE_LOAD_FAILED",
    PATTERN_DETECTION_FAILED = "PATTERNS_DETECTION_FAILED",
    INCIDENT_IMPORT_FAILED = "PATTERNS_INCIDENT_IMPORT_FAILED",
    EXPORT_FAILED = "IO_EXPORT_FAILED",
    IMPORT_FAILED = "IO_IMPORT_FAILED",
    FILE_NOT_FOUND = "IO_FILE_NOT_FOUND",
    PERMISSION_DENIED = "IO_PERMISSION_DENIED",
    AUTHORIZATION_FAILED = "AUTH_AUTHORIZATION_FAILED",
    SAVE_FAILED = "AUTH_SAVE_FAILED",
    UPDATE_FAILED = "AUTH_UPDATE_FAILED",
    COST_ESTIMATION_FAILED = "AUTH_COST_ESTIMATION_FAILED",
    AUTO_APPROVAL_CHECK_FAILED = "AUTH_AUTO_APPROVAL_CHECK_FAILED",
    STATS_RETRIEVAL_FAILED = "AUTH_STATS_RETRIEVAL_FAILED",
    SESSION_CLEAR_FAILED = "AUTH_SESSION_CLEAR_FAILED",
    INVALID_REQUEST_DATA = "AUTH_INVALID_REQUEST_DATA"
}
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
        minConfidence?: number;
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
export interface KBEntryCreateRequest extends BaseIPCRequest {
    channel: 'kb:entry:create';
    entry: KBEntryInput;
    options?: {
        validate?: boolean;
        duplicateCheck?: boolean;
        autoTags?: boolean;
        notifyUsers?: boolean;
    };
}
export interface KBEntryCreateResponse extends BaseIPCResponse<string> {
    data: string;
    metadata: ResponseMetadata & {
        duplicatesFound?: number;
        autoGeneratedTags?: string[];
        validationPassed: boolean;
    };
}
export interface KBEntryGetRequest extends BaseIPCRequest {
    channel: 'kb:entry:get';
    id: string;
    options?: {
        includeMetrics?: boolean;
        includeRevisions?: boolean;
        includeRelated?: boolean;
        markAsViewed?: boolean;
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
export interface KBEntryUpdateRequest extends BaseIPCRequest {
    channel: 'kb:entry:update';
    id: string;
    updates: Partial<KBEntryInput>;
    options?: {
        validate?: boolean;
        createRevision?: boolean;
        notifyUsers?: boolean;
        reason?: string;
    };
}
export interface KBEntryUpdateResponse extends BaseIPCResponse<void> {
    metadata: ResponseMetadata & {
        revisionId?: string;
        affectedUsers?: number;
        validationWarnings?: string[];
    };
}
export interface KBEntryDeleteRequest extends BaseIPCRequest {
    channel: 'kb:entry:delete';
    id: string;
    options?: {
        softDelete?: boolean;
        reason?: string;
        transferReferences?: boolean;
    };
}
export interface KBFeedbackRequest extends BaseIPCRequest {
    channel: 'kb:feedback:rate';
    entryId: string;
    rating: 'helpful' | 'not_helpful';
    comment?: string;
    context?: {
        searchQuery?: string;
        problemResolved?: boolean;
        timeToResolve?: number;
    };
}
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
        metricsAge: number;
        nextUpdateIn: number;
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
export interface PatternDetectionRequest extends BaseIPCRequest {
    channel: 'patterns:detect:run';
    options?: {
        timeWindow?: number;
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
        progress: number;
        remainingChunks: number;
        estimatedTimeRemaining?: number;
    };
}
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
    channelReports: Array<{
        channel: string;
        healthScore: number;
    } & ChannelMetrics>;
    systemHealth: number;
    recommendations: string[];
}
export declare const IPCSchemas: {
    readonly BaseRequest: z.ZodObject<{
        requestId: z.ZodString;
        timestamp: z.ZodNumber;
        channel: z.ZodString;
        version: z.ZodString;
        userId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        version: string;
        timestamp: number;
        requestId: string;
        channel: string;
        userId?: string | undefined;
    }, {
        version: string;
        timestamp: number;
        requestId: string;
        channel: string;
        userId?: string | undefined;
    }>;
    readonly KBSearch: z.ZodObject<{
        query: z.ZodString;
        options: z.ZodOptional<z.ZodObject<{
            limit: z.ZodOptional<z.ZodNumber>;
            offset: z.ZodOptional<z.ZodNumber>;
            categories: z.ZodOptional<z.ZodArray<z.ZodEnum<["JCL", "VSAM", "DB2", "Batch", "Functional", "Other"]>, "many">>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            includeArchived: z.ZodOptional<z.ZodBoolean>;
            sortBy: z.ZodOptional<z.ZodEnum<["relevance", "date", "usage", "rating"]>>;
            sortOrder: z.ZodOptional<z.ZodEnum<["asc", "desc"]>>;
            minConfidence: z.ZodOptional<z.ZodNumber>;
            useSemanticSearch: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            tags?: string[] | undefined;
            limit?: number | undefined;
            includeArchived?: boolean | undefined;
            offset?: number | undefined;
            sortBy?: "relevance" | "usage" | "date" | "rating" | undefined;
            categories?: ("JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other")[] | undefined;
            sortOrder?: "asc" | "desc" | undefined;
            minConfidence?: number | undefined;
            useSemanticSearch?: boolean | undefined;
        }, {
            tags?: string[] | undefined;
            limit?: number | undefined;
            includeArchived?: boolean | undefined;
            offset?: number | undefined;
            sortBy?: "relevance" | "usage" | "date" | "rating" | undefined;
            categories?: ("JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other")[] | undefined;
            sortOrder?: "asc" | "desc" | undefined;
            minConfidence?: number | undefined;
            useSemanticSearch?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        query: string;
        options?: {
            tags?: string[] | undefined;
            limit?: number | undefined;
            includeArchived?: boolean | undefined;
            offset?: number | undefined;
            sortBy?: "relevance" | "usage" | "date" | "rating" | undefined;
            categories?: ("JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other")[] | undefined;
            sortOrder?: "asc" | "desc" | undefined;
            minConfidence?: number | undefined;
            useSemanticSearch?: boolean | undefined;
        } | undefined;
    }, {
        query: string;
        options?: {
            tags?: string[] | undefined;
            limit?: number | undefined;
            includeArchived?: boolean | undefined;
            offset?: number | undefined;
            sortBy?: "relevance" | "usage" | "date" | "rating" | undefined;
            categories?: ("JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other")[] | undefined;
            sortOrder?: "asc" | "desc" | undefined;
            minConfidence?: number | undefined;
            useSemanticSearch?: boolean | undefined;
        } | undefined;
    }>;
    readonly KBEntryCreate: z.ZodObject<{
        entry: z.ZodObject<{
            title: z.ZodString;
            problem: z.ZodString;
            solution: z.ZodString;
            category: z.ZodEnum<["JCL", "VSAM", "DB2", "Batch", "Functional", "Other"]>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            title: string;
            problem: string;
            solution: string;
            category: "JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other";
            tags?: string[] | undefined;
        }, {
            title: string;
            problem: string;
            solution: string;
            category: "JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other";
            tags?: string[] | undefined;
        }>;
        options: z.ZodOptional<z.ZodObject<{
            validate: z.ZodOptional<z.ZodBoolean>;
            duplicateCheck: z.ZodOptional<z.ZodBoolean>;
            autoTags: z.ZodOptional<z.ZodBoolean>;
            notifyUsers: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            validate?: boolean | undefined;
            duplicateCheck?: boolean | undefined;
            autoTags?: boolean | undefined;
            notifyUsers?: boolean | undefined;
        }, {
            validate?: boolean | undefined;
            duplicateCheck?: boolean | undefined;
            autoTags?: boolean | undefined;
            notifyUsers?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        entry: {
            title: string;
            problem: string;
            solution: string;
            category: "JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other";
            tags?: string[] | undefined;
        };
        options?: {
            validate?: boolean | undefined;
            duplicateCheck?: boolean | undefined;
            autoTags?: boolean | undefined;
            notifyUsers?: boolean | undefined;
        } | undefined;
    }, {
        entry: {
            title: string;
            problem: string;
            solution: string;
            category: "JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other";
            tags?: string[] | undefined;
        };
        options?: {
            validate?: boolean | undefined;
            duplicateCheck?: boolean | undefined;
            autoTags?: boolean | undefined;
            notifyUsers?: boolean | undefined;
        } | undefined;
    }>;
    readonly KBEntryUpdate: z.ZodObject<{
        id: z.ZodString;
        updates: z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            problem: z.ZodOptional<z.ZodString>;
            solution: z.ZodOptional<z.ZodString>;
            category: z.ZodOptional<z.ZodEnum<["JCL", "VSAM", "DB2", "Batch", "Functional", "Other"]>>;
            tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            title?: string | undefined;
            problem?: string | undefined;
            solution?: string | undefined;
            category?: "JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other" | undefined;
            tags?: string[] | undefined;
        }, {
            title?: string | undefined;
            problem?: string | undefined;
            solution?: string | undefined;
            category?: "JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other" | undefined;
            tags?: string[] | undefined;
        }>;
        options: z.ZodOptional<z.ZodObject<{
            validate: z.ZodOptional<z.ZodBoolean>;
            createRevision: z.ZodOptional<z.ZodBoolean>;
            notifyUsers: z.ZodOptional<z.ZodBoolean>;
            reason: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            reason?: string | undefined;
            validate?: boolean | undefined;
            notifyUsers?: boolean | undefined;
            createRevision?: boolean | undefined;
        }, {
            reason?: string | undefined;
            validate?: boolean | undefined;
            notifyUsers?: boolean | undefined;
            createRevision?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        updates: {
            title?: string | undefined;
            problem?: string | undefined;
            solution?: string | undefined;
            category?: "JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other" | undefined;
            tags?: string[] | undefined;
        };
        options?: {
            reason?: string | undefined;
            validate?: boolean | undefined;
            notifyUsers?: boolean | undefined;
            createRevision?: boolean | undefined;
        } | undefined;
    }, {
        id: string;
        updates: {
            title?: string | undefined;
            problem?: string | undefined;
            solution?: string | undefined;
            category?: "JCL" | "VSAM" | "DB2" | "Batch" | "Functional" | "Other" | undefined;
            tags?: string[] | undefined;
        };
        options?: {
            reason?: string | undefined;
            validate?: boolean | undefined;
            notifyUsers?: boolean | undefined;
            createRevision?: boolean | undefined;
        } | undefined;
    }>;
    readonly SystemMetrics: z.ZodObject<{
        scope: z.ZodOptional<z.ZodEnum<["all", "database", "cache", "performance", "ipc"]>>;
        timeRange: z.ZodOptional<z.ZodObject<{
            start: z.ZodNumber;
            end: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            start: number;
            end: number;
        }, {
            start: number;
            end: number;
        }>>;
        aggregation: z.ZodOptional<z.ZodEnum<["raw", "hourly", "daily"]>>;
    }, "strip", z.ZodTypeAny, {
        scope?: "cache" | "database" | "performance" | "all" | "ipc" | undefined;
        timeRange?: {
            start: number;
            end: number;
        } | undefined;
        aggregation?: "hourly" | "daily" | "raw" | undefined;
    }, {
        scope?: "cache" | "database" | "performance" | "all" | "ipc" | undefined;
        timeRange?: {
            start: number;
            end: number;
        } | undefined;
        aggregation?: "hourly" | "daily" | "raw" | undefined;
    }>;
    readonly PatternDetection: z.ZodObject<{
        options: z.ZodOptional<z.ZodObject<{
            timeWindow: z.ZodOptional<z.ZodNumber>;
            minIncidents: z.ZodOptional<z.ZodNumber>;
            categories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            confidenceThreshold: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            categories?: string[] | undefined;
            timeWindow?: number | undefined;
            minIncidents?: number | undefined;
            confidenceThreshold?: number | undefined;
        }, {
            categories?: string[] | undefined;
            timeWindow?: number | undefined;
            minIncidents?: number | undefined;
            confidenceThreshold?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        options?: {
            categories?: string[] | undefined;
            timeWindow?: number | undefined;
            minIncidents?: number | undefined;
            confidenceThreshold?: number | undefined;
        } | undefined;
    }, {
        options?: {
            categories?: string[] | undefined;
            timeWindow?: number | undefined;
            minIncidents?: number | undefined;
            confidenceThreshold?: number | undefined;
        } | undefined;
    }>;
    readonly EntityId: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    readonly EntityIds: z.ZodObject<{
        ids: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        ids: string[];
    }, {
        ids: string[];
    }>;
};
export type IPCRequestForChannel<T extends IPCChannel> = T extends 'kb:search:local' | 'kb:search:ai' ? KBSearchRequest : T extends 'kb:entry:create' ? KBEntryCreateRequest : T extends 'kb:entry:get' ? KBEntryGetRequest : T extends 'kb:entry:update' ? KBEntryUpdateRequest : T extends 'kb:entry:delete' ? KBEntryDeleteRequest : T extends 'system:metrics:get' ? SystemMetricsRequest : T extends 'system:database:status' ? DatabaseStatusRequest : T extends 'system:health:check' ? HealthCheckRequest : T extends 'patterns:detect:run' ? PatternDetectionRequest : BaseIPCRequest;
export type IPCResponseForChannel<T extends IPCChannel> = T extends 'kb:search:local' | 'kb:search:ai' ? KBSearchResponse : T extends 'kb:entry:create' ? KBEntryCreateResponse : T extends 'kb:entry:get' ? KBEntryGetResponse : T extends 'kb:entry:update' ? KBEntryUpdateResponse : T extends 'system:metrics:get' ? SystemMetricsResponse : T extends 'system:database:status' ? DatabaseStatusResponse : T extends 'system:health:check' ? HealthCheckResponse : T extends 'patterns:detect:run' ? PatternDetectionResponse : BaseIPCResponse;
export type IPCHandlerFunction<T extends IPCChannel> = (request: IPCRequestForChannel<T>) => Promise<IPCResponseForChannel<T>>;
export interface IPCHandlerConfig {
    batchable?: boolean;
    batchSize?: number;
    batchDelay?: number;
    streamable?: boolean;
    streamChunkSize?: number;
    cacheable?: boolean;
    cacheTTL?: number;
    cacheStrategy?: Partial<CacheStrategy>;
    requireAuth?: boolean;
    allowedRoles?: string[];
    rateLimitConfig?: {
        requests: number;
        windowMs: number;
    };
    validateInput?: boolean;
    sanitizeInput?: boolean;
    schema?: z.ZodSchema;
    trackMetrics?: boolean;
    logRequests?: boolean;
    alertOnErrors?: boolean;
}
export type { KBEntry, KBEntryInput, KBEntryUpdate, SearchResult, SearchQuery, KBCategory } from './index';
export interface IPCEvents {
    'request:start': {
        channel: string;
        requestId: string;
    };
    'request:complete': {
        channel: string;
        requestId: string;
        success: boolean;
        duration: number;
    };
    'error': {
        error: IPCError;
        channel: string;
        requestId: string;
    };
    'cache:hit': {
        channel: string;
        key: string;
    };
    'cache:miss': {
        channel: string;
        key: string;
    };
    'cache:invalidate': {
        pattern: string;
        keysInvalidated: number;
    };
    'batch:created': {
        batchId: string;
        size: number;
    };
    'batch:executed': {
        batchId: string;
        success: boolean;
        duration: number;
    };
    'stream:start': {
        streamId: string;
        channel: string;
    };
    'stream:chunk': {
        streamId: string;
        chunkIndex: number;
    };
    'stream:complete': {
        streamId: string;
        totalChunks: number;
    };
    'metrics:updated': {
        timestamp: number;
        metrics: RealTimeMetrics;
    };
}
export interface IPCEventEmitter {
    emit<K extends keyof IPCEvents>(event: K, data: IPCEvents[K]): boolean;
    on<K extends keyof IPCEvents>(event: K, listener: (data: IPCEvents[K]) => void): this;
    off<K extends keyof IPCEvents>(event: K, listener: (data: IPCEvents[K]) => void): this;
    once<K extends keyof IPCEvents>(event: K, listener: (data: IPCEvents[K]) => void): this;
}
//# sourceMappingURL=ipc.d.ts.map