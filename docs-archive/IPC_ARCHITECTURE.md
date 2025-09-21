# IPC Architecture Design
## Mainframe Knowledge Base Assistant - Production-Ready IPC System
### Version 1.0 | System Architect Design

---

## 1. EXECUTIVE SUMMARY

This document outlines a comprehensive Inter-Process Communication (IPC) architecture for the Mainframe Knowledge Base Assistant Electron application. The design focuses on security, type safety, performance optimization, and scalability while adhering to Electron best practices.

### Key Architectural Goals
- **Security First**: Strict channel validation and data sanitization
- **Type Safety**: Full TypeScript integration with compile-time guarantees
- **Performance**: Optimized batching, caching, and streaming capabilities
- **Reliability**: Comprehensive error handling and graceful degradation
- **Maintainability**: Clear separation of concerns and modular design
- **Scalability**: Support for future MVPs with minimal architectural changes

---

## 2. IPC ARCHITECTURE OVERVIEW

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RENDERER PROCESS                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   React App     │  │  Type-Safe API  │  │    Error Boundary       │  │
│  │   Components    │←→│     Client      │←→│   & Retry Logic         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    PRELOAD SCRIPT                                   │ │
│  │  ┌─────────────────┐  ┌──────────────┐  ┌───────────────────────┐  │ │
│  │  │   Context       │  │  Type Guard  │  │   Security Layer      │  │ │
│  │  │   Bridge        │  │  Validators  │  │   & Sanitization      │  │ │
│  │  └─────────────────┘  └──────────────┘  └───────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────┬───────────────────────────────────────────────────┘
                      │ IPC Communication (secure contextBridge)
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          MAIN PROCESS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      IPC MANAGER                                    │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────────┐│ │
│  │  │  Channel     │  │   Request    │  │      Performance            ││ │
│  │  │  Registry &  │  │   Batching   │  │      Monitor                ││ │
│  │  │  Validation  │  │   Engine     │  │                             ││ │
│  │  └──────────────┘  └──────────────┘  └─────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   Knowledge     │  │   Cache Layer   │  │    Security Manager     │  │
│  │   Service       │  │   with TTL      │  │    & Rate Limiting      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     DATABASE LAYER                                  │ │
│  │              (SQLite with Connection Pooling)                       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. CHANNEL STRUCTURE AND NAMING CONVENTIONS

### 3.1 Channel Naming Convention

**Pattern**: `{domain}:{operation}:{scope?}`

```typescript
// Knowledge Base Operations
'kb:search:local'           // Local SQLite search
'kb:search:ai'              // AI-enhanced search with Gemini
'kb:entry:create'           // Create new KB entry
'kb:entry:update'           // Update existing entry
'kb:entry:delete'           // Delete entry
'kb:entry:get'              // Get single entry by ID
'kb:feedback:rate'          // Rate entry usefulness

// System Operations  
'system:metrics:get'        // Get system metrics
'system:database:status'    // Check database status
'system:cache:invalidate'   // Invalidate cache patterns
'system:health:check'       // System health check

// Import/Export Operations (MVP4)
'io:export:kb'              // Export knowledge base
'io:import:kb'              // Import knowledge base
'io:project:import'         // Import IDZ project
'io:project:export'         // Export to IDZ

// Pattern Detection (MVP2)
'patterns:detect:run'       // Run pattern detection
'patterns:incidents:import' // Import incident data
'patterns:alerts:get'       // Get pattern alerts

// Window Management
'window:state:get'          // Get window state
'window:state:update'       // Update window state
'window:control:minimize'   // Minimize window
'window:control:maximize'   // Maximize window

// Application Lifecycle
'app:version:get'           // Get application version
'app:theme:get'            // Get current theme
'app:theme:set'            // Set theme
'app:close'                // Close application
```

### 3.2 Channel Categories

```typescript
export enum ChannelCategory {
  KNOWLEDGE_BASE = 'kb',
  SYSTEM = 'system',
  IMPORT_EXPORT = 'io', 
  PATTERNS = 'patterns',
  WINDOW = 'window',
  APPLICATION = 'app',
  DEVELOPMENT = 'dev' // For dev tools and debugging
}

export enum ChannelOperation {
  // CRUD Operations
  CREATE = 'create',
  READ = 'get',
  UPDATE = 'update',
  DELETE = 'delete',
  
  // Search Operations
  SEARCH = 'search',
  FILTER = 'filter',
  
  // System Operations
  STATUS = 'status',
  METRICS = 'metrics',
  HEALTH = 'health',
  
  // Control Operations
  CONTROL = 'control',
  STATE = 'state',
  
  // Data Operations
  IMPORT = 'import',
  EXPORT = 'export'
}
```

---

## 4. TYPE-SAFE MESSAGE INTERFACES

### 4.1 Core IPC Types

```typescript
/**
 * Base interface for all IPC requests
 */
export interface BaseIPCRequest {
  readonly requestId: string;
  readonly timestamp: number;
  readonly channel: string;
  readonly version: string; // API version for compatibility
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
 * IPC Error structure
 */
export interface IPCError {
  readonly code: IPCErrorCode;
  readonly message: string;
  readonly details?: Record<string, any>;
  readonly stack?: string; // Only in development
}

/**
 * Response metadata for debugging and optimization
 */
export interface ResponseMetadata {
  readonly cached: boolean;
  readonly batched: boolean;
  readonly streamed: boolean;
  readonly fromCache?: string; // Cache layer identifier
  readonly performanceMetrics?: {
    dbQueryTime?: number;
    serializationTime?: number;
    networkTime?: number;
  };
}
```

### 4.2 Knowledge Base Operation Types

```typescript
// Search Operations
export interface KBSearchRequest extends BaseIPCRequest {
  channel: 'kb:search:local' | 'kb:search:ai';
  query: string;
  options?: {
    limit?: number;
    offset?: number;
    categories?: KBCategory[];
    includeArchived?: boolean;
    sortBy?: 'relevance' | 'date' | 'usage' | 'rating';
    sortOrder?: 'asc' | 'desc';
  };
}

export interface KBSearchResponse extends BaseIPCResponse<SearchResult[]> {
  data: SearchResult[];
  metadata: ResponseMetadata & {
    totalResults: number;
    searchType: 'exact' | 'fuzzy' | 'semantic';
    aiConfidence?: number;
  };
}

// Entry Operations
export interface KBEntryCreateRequest extends BaseIPCRequest {
  channel: 'kb:entry:create';
  entry: KBEntryInput;
  options?: {
    validate?: boolean;
    duplicateCheck?: boolean;
  };
}

export interface KBEntryCreateResponse extends BaseIPCResponse<string> {
  data: string; // Created entry ID
}

export interface KBEntryUpdateRequest extends BaseIPCRequest {
  channel: 'kb:entry:update';
  id: string;
  updates: Partial<KBEntryInput>;
  options?: {
    validate?: boolean;
    createRevision?: boolean;
  };
}

export interface KBEntryGetRequest extends BaseIPCRequest {
  channel: 'kb:entry:get';
  id: string;
  options?: {
    includeMetrics?: boolean;
    includeRevisions?: boolean;
  };
}

export interface KBEntryGetResponse extends BaseIPCResponse<KBEntry | null> {
  data: KBEntry | null;
}
```

### 4.3 System Operation Types

```typescript
export interface SystemMetricsRequest extends BaseIPCRequest {
  channel: 'system:metrics:get';
  scope?: 'all' | 'database' | 'cache' | 'performance';
  timeRange?: {
    start: number;
    end: number;
  };
}

export interface SystemMetricsResponse extends BaseIPCResponse<DatabaseMetrics> {
  data: DatabaseMetrics & {
    ipcMetrics?: IPCMetrics;
    cacheMetrics?: CacheMetrics;
    performanceMetrics?: PerformanceMetrics;
  };
}

export interface DatabaseStatusRequest extends BaseIPCRequest {
  channel: 'system:database:status';
}

export interface DatabaseStatusResponse extends BaseIPCResponse<DatabaseStatus> {
  data: {
    connected: boolean;
    healthy: boolean;
    version: string;
    totalEntries: number;
    lastBackup?: number;
    performance: {
      averageQueryTime: number;
      activeConnections: number;
    };
  };
}
```

### 4.4 Streaming Types (for large datasets)

```typescript
export interface StreamRequest extends BaseIPCRequest {
  streamable: true;
  chunkSize?: number;
  maxChunks?: number;
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
  metadata?: {
    progress: number; // 0-100%
    remainingChunks: number;
  };
}
```

---

## 5. SECURITY LAYER DESIGN

### 5.1 Security Architecture

```typescript
/**
 * Security Manager for IPC operations
 */
export class IPCSecurityManager {
  private readonly allowedChannels: Set<string>;
  private readonly rateLimiters: Map<string, RateLimiter>;
  private readonly validator: SecurityValidator;

  constructor() {
    this.allowedChannels = this.initializeAllowedChannels();
    this.rateLimiters = new Map();
    this.validator = new SecurityValidator();
  }

  /**
   * Validate that the channel is allowed and request is secure
   */
  validateRequest(channel: string, args: any[]): ValidationResult {
    // 1. Channel whitelist validation
    if (!this.allowedChannels.has(channel)) {
      return {
        valid: false,
        error: {
          code: 'INVALID_CHANNEL',
          message: `Channel ${channel} is not allowed`
        }
      };
    }

    // 2. Rate limiting
    const rateLimitResult = this.checkRateLimit(channel);
    if (!rateLimitResult.allowed) {
      return {
        valid: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded for ${channel}`
        }
      };
    }

    // 3. Input sanitization
    const sanitizationResult = this.sanitizeInput(args);
    if (!sanitizationResult.clean) {
      return {
        valid: false,
        error: {
          code: 'MALICIOUS_INPUT',
          message: 'Input contains potentially malicious content'
        }
      };
    }

    // 4. Schema validation
    const schemaResult = this.validator.validateSchema(channel, args);
    if (!schemaResult.valid) {
      return {
        valid: false,
        error: {
          code: 'SCHEMA_VALIDATION_FAILED',
          message: schemaResult.message
        }
      };
    }

    return { valid: true, sanitizedArgs: sanitizationResult.args };
  }

  private sanitizeInput(args: any[]): { clean: boolean; args: any[] } {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'string') {
        // Remove potential script injections
        return arg
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
      
      if (typeof arg === 'object' && arg !== null) {
        return this.sanitizeObject(arg);
      }
      
      return arg;
    });

    return { clean: true, args: sanitizedArgs };
  }

  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize key names
        const cleanKey = key.replace(/[^\w-]/g, '');
        
        // Recursively sanitize values
        sanitized[cleanKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }
}
```

### 5.2 Input Validation Schemas

```typescript
/**
 * Zod schemas for type-safe validation
 */
export const IPCSchemas = {
  // Knowledge Base Schemas
  KBSearch: z.object({
    query: z.string().min(1).max(1000),
    options: z.object({
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
      categories: z.array(z.enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'])).optional()
    }).optional()
  }),

  KBEntryCreate: z.object({
    entry: z.object({
      title: z.string().min(1).max(255),
      problem: z.string().min(1).max(10000),
      solution: z.string().min(1).max(10000),
      category: z.enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other']),
      tags: z.array(z.string().max(50)).max(20).optional()
    }),
    options: z.object({
      validate: z.boolean().optional(),
      duplicateCheck: z.boolean().optional()
    }).optional()
  }),

  // System Schemas
  SystemMetrics: z.object({
    scope: z.enum(['all', 'database', 'cache', 'performance']).optional(),
    timeRange: z.object({
      start: z.number().int(),
      end: z.number().int()
    }).optional()
  }),

  // General ID Schema
  EntityId: z.object({
    id: z.string().uuid()
  })
} as const;

/**
 * Schema validator
 */
export class SecurityValidator {
  validateSchema(channel: string, args: any[]): ValidationResult {
    try {
      switch (channel) {
        case 'kb:search:local':
        case 'kb:search:ai':
          IPCSchemas.KBSearch.parse(args[0] || {});
          break;
        
        case 'kb:entry:create':
          IPCSchemas.KBEntryCreate.parse(args[0] || {});
          break;
        
        case 'kb:entry:get':
        case 'kb:entry:update':
        case 'kb:entry:delete':
          IPCSchemas.EntityId.parse({ id: args[0] });
          break;
          
        case 'system:metrics:get':
          if (args[0]) {
            IPCSchemas.SystemMetrics.parse(args[0]);
          }
          break;
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        message: error instanceof z.ZodError 
          ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
          : 'Invalid input format'
      };
    }
  }
}
```

---

## 6. ERROR HANDLING ARCHITECTURE

### 6.1 Error Classification System

```typescript
export enum IPCErrorCode {
  // Client Errors (4xx equivalent)
  INVALID_CHANNEL = 'IPC_INVALID_CHANNEL',
  VALIDATION_FAILED = 'IPC_VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'IPC_RATE_LIMIT_EXCEEDED',
  MALICIOUS_INPUT = 'IPC_MALICIOUS_INPUT',
  INSUFFICIENT_PERMISSIONS = 'IPC_INSUFFICIENT_PERMISSIONS',
  
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
  
  // Business Logic Errors
  ENTRY_NOT_FOUND = 'KB_ENTRY_NOT_FOUND',
  DUPLICATE_ENTRY = 'KB_DUPLICATE_ENTRY',
  INVALID_SEARCH_QUERY = 'KB_INVALID_SEARCH_QUERY'
}

/**
 * Comprehensive error handler for IPC operations
 */
export class IPCErrorHandler {
  private readonly logger: Logger;
  private readonly metrics: ErrorMetrics;

  constructor(logger: Logger) {
    this.logger = logger;
    this.metrics = new ErrorMetrics();
  }

  handleError(error: unknown, context: ErrorContext): IPCError {
    const ipcError = this.transformError(error, context);
    
    // Log error with appropriate level
    this.logError(ipcError, context);
    
    // Update error metrics
    this.metrics.recordError(ipcError.code, context.channel);
    
    // Emit error event for monitoring
    EventBus.emit('ipc:error', { error: ipcError, context });
    
    return ipcError;
  }

  private transformError(error: unknown, context: ErrorContext): IPCError {
    // Handle known error types
    if (error instanceof AppError) {
      return {
        code: error.code as IPCErrorCode,
        message: error.message,
        details: error.details
      };
    }
    
    if (error instanceof z.ZodError) {
      return {
        code: IPCErrorCode.VALIDATION_FAILED,
        message: 'Input validation failed',
        details: {
          issues: error.issues,
          path: error.issues[0]?.path
        }
      };
    }
    
    // Handle database errors
    if (this.isDatabaseError(error)) {
      return {
        code: IPCErrorCode.DATABASE_ERROR,
        message: 'Database operation failed',
        details: { originalError: this.sanitizeError(error) }
      };
    }
    
    // Handle timeout errors
    if (this.isTimeoutError(error)) {
      return {
        code: IPCErrorCode.TIMEOUT,
        message: `Operation timed out in channel: ${context.channel}`,
        details: { timeout: context.timeout }
      };
    }
    
    // Generic error handling
    return {
      code: IPCErrorCode.HANDLER_ERROR,
      message: 'An unexpected error occurred',
      details: this.sanitizeError(error)
    };
  }

  private logError(error: IPCError, context: ErrorContext): void {
    const logData = {
      channel: context.channel,
      code: error.code,
      message: error.message,
      requestId: context.requestId,
      userId: context.userId,
      timestamp: new Date().toISOString()
    };

    switch (this.getErrorSeverity(error.code)) {
      case 'critical':
        this.logger.error('Critical IPC Error', logData);
        break;
      case 'error':
        this.logger.error('IPC Error', logData);
        break;
      case 'warning':
        this.logger.warn('IPC Warning', logData);
        break;
      default:
        this.logger.info('IPC Info', logData);
    }
  }

  private getErrorSeverity(code: IPCErrorCode): 'critical' | 'error' | 'warning' | 'info' {
    const severityMap: Record<IPCErrorCode, 'critical' | 'error' | 'warning' | 'info'> = {
      [IPCErrorCode.DATABASE_ERROR]: 'critical',
      [IPCErrorCode.MEMORY_ERROR]: 'critical',
      [IPCErrorCode.UNHANDLED_REJECTION]: 'critical',
      
      [IPCErrorCode.HANDLER_ERROR]: 'error',
      [IPCErrorCode.EXTERNAL_SERVICE_ERROR]: 'error',
      [IPCErrorCode.CACHE_ERROR]: 'error',
      
      [IPCErrorCode.RATE_LIMIT_EXCEEDED]: 'warning',
      [IPCErrorCode.VALIDATION_FAILED]: 'warning',
      [IPCErrorCode.TIMEOUT]: 'warning',
      
      [IPCErrorCode.ENTRY_NOT_FOUND]: 'info',
      [IPCErrorCode.INVALID_SEARCH_QUERY]: 'info'
    } as any;

    return severityMap[code] || 'error';
  }
}
```

### 6.2 Graceful Degradation Strategy

```typescript
/**
 * Fallback and recovery strategies for IPC operations
 */
export class IPCRecoveryManager {
  private readonly fallbackStrategies = new Map<string, FallbackStrategy>();

  constructor() {
    this.initializeFallbackStrategies();
  }

  private initializeFallbackStrategies(): void {
    // AI Search Fallback: Use local search if AI fails
    this.fallbackStrategies.set('kb:search:ai', {
      fallbackChannel: 'kb:search:local',
      retryCount: 2,
      retryDelay: 1000,
      canFallback: true
    });

    // Database fallback: Use cached data if available
    this.fallbackStrategies.set('kb:entry:get', {
      fallbackChannel: null,
      retryCount: 3,
      retryDelay: 500,
      canFallback: false,
      fallbackData: (args) => this.getCachedEntry(args[0])
    });

    // Metrics fallback: Return basic metrics if detailed fail
    this.fallbackStrategies.set('system:metrics:get', {
      fallbackChannel: null,
      retryCount: 1,
      retryDelay: 1000,
      canFallback: false,
      fallbackData: () => this.getBasicMetrics()
    });
  }

  async handleFailure(channel: string, error: IPCError, args: any[]): Promise<any> {
    const strategy = this.fallbackStrategies.get(channel);
    
    if (!strategy) {
      throw error; // No recovery strategy available
    }

    // Try retries first
    if (strategy.retryCount > 0) {
      for (let i = 0; i < strategy.retryCount; i++) {
        await this.delay(strategy.retryDelay * (i + 1));
        
        try {
          // Attempt to re-execute the original operation
          return await this.retryOperation(channel, args);
        } catch (retryError) {
          if (i === strategy.retryCount - 1) {
            // Last retry failed, proceed to fallback
            break;
          }
        }
      }
    }

    // Try fallback strategies
    if (strategy.canFallback && strategy.fallbackChannel) {
      try {
        return await this.executeFallback(strategy.fallbackChannel, args);
      } catch (fallbackError) {
        // Fallback also failed, use fallback data if available
      }
    }

    // Use fallback data if available
    if (strategy.fallbackData) {
      return await strategy.fallbackData(args);
    }

    // No recovery possible
    throw error;
  }
}
```

---

## 7. PERFORMANCE OPTIMIZATION DESIGN

### 7.1 Request Batching System

```typescript
/**
 * Advanced request batching with intelligent grouping
 */
export class AdvancedRequestBatcher {
  private readonly batchQueues = new Map<string, BatchQueue>();
  private readonly batchConfigs = new Map<string, BatchConfig>();

  constructor() {
    this.initializeBatchConfigs();
  }

  private initializeBatchConfigs(): void {
    // High-frequency operations with small payloads
    this.batchConfigs.set('kb:entry:get', {
      maxBatchSize: 50,
      maxDelayMs: 25,
      groupingStrategy: 'by-user',
      priority: 'high'
    });

    // Search operations
    this.batchConfigs.set('kb:search:local', {
      maxBatchSize: 10,
      maxDelayMs: 100,
      groupingStrategy: 'by-similarity',
      priority: 'medium',
      deduplication: true
    });

    // Metrics collection
    this.batchConfigs.set('system:metrics:get', {
      maxBatchSize: 20,
      maxDelayMs: 200,
      groupingStrategy: 'by-scope',
      priority: 'low'
    });
  }

  async addRequest(request: BatchableRequest): Promise<any> {
    const config = this.batchConfigs.get(request.channel);
    
    if (!config) {
      // Not batchable, execute immediately
      return await this.executeImmediately(request);
    }

    const queueKey = this.generateQueueKey(request, config);
    let queue = this.batchQueues.get(queueKey);

    if (!queue) {
      queue = new BatchQueue(config);
      this.batchQueues.set(queueKey, queue);
    }

    return await queue.addRequest(request);
  }

  private generateQueueKey(request: BatchableRequest, config: BatchConfig): string {
    const baseKey = request.channel;

    switch (config.groupingStrategy) {
      case 'by-user':
        return `${baseKey}:user:${request.userId || 'anonymous'}`;
      
      case 'by-similarity':
        // Group similar search queries together
        return `${baseKey}:sim:${this.getSearchCategory(request.args[0])}`;
      
      case 'by-scope':
        // Group by operation scope
        return `${baseKey}:scope:${request.args[0]?.scope || 'default'}`;
      
      default:
        return baseKey;
    }
  }
}
```

### 7.2 Intelligent Caching Strategy

```typescript
/**
 * Multi-layer caching with TTL and invalidation
 */
export class IPCCacheManager {
  private readonly memoryCache: Map<string, CacheEntry>;
  private readonly persistentCache: SqliteCache;
  private readonly cacheStrategies = new Map<string, CacheStrategy>();

  constructor() {
    this.memoryCache = new Map();
    this.persistentCache = new SqliteCache();
    this.initializeCacheStrategies();
  }

  private initializeCacheStrategies(): void {
    // Knowledge base entries - long TTL, invalidate on updates
    this.cacheStrategies.set('kb:entry:get', {
      ttl: 30 * 60 * 1000, // 30 minutes
      layer: 'both',
      invalidateOn: ['kb:entry:update', 'kb:entry:delete'],
      keyGenerator: (args) => `kb:entry:${args[0]}`,
      compressionThreshold: 1000
    });

    // Search results - medium TTL, frequent invalidation
    this.cacheStrategies.set('kb:search:local', {
      ttl: 5 * 60 * 1000, // 5 minutes
      layer: 'memory',
      invalidateOn: ['kb:entry:create', 'kb:entry:update', 'kb:entry:delete'],
      keyGenerator: (args) => `kb:search:${this.hashSearchQuery(args[0])}`,
      maxSize: 100
    });

    // System metrics - short TTL, no invalidation needed
    this.cacheStrategies.set('system:metrics:get', {
      ttl: 60 * 1000, // 1 minute
      layer: 'memory',
      keyGenerator: (args) => `metrics:${args[0]?.scope || 'all'}`,
      maxSize: 20
    });
  }

  async get(channel: string, args: any[]): Promise<any | null> {
    const strategy = this.cacheStrategies.get(channel);
    
    if (!strategy) {
      return null; // No caching strategy defined
    }

    const key = strategy.keyGenerator(args);
    
    // Try memory cache first
    if (strategy.layer === 'memory' || strategy.layer === 'both') {
      const memoryResult = this.memoryCache.get(key);
      if (memoryResult && !this.isExpired(memoryResult)) {
        return memoryResult.data;
      }
    }

    // Try persistent cache
    if (strategy.layer === 'persistent' || strategy.layer === 'both') {
      const persistentResult = await this.persistentCache.get(key);
      if (persistentResult && !this.isExpired(persistentResult)) {
        // Promote to memory cache
        if (strategy.layer === 'both') {
          this.memoryCache.set(key, persistentResult);
        }
        return persistentResult.data;
      }
    }

    return null;
  }

  async set(channel: string, args: any[], data: any): Promise<void> {
    const strategy = this.cacheStrategies.get(channel);
    
    if (!strategy) {
      return; // No caching strategy defined
    }

    const key = strategy.keyGenerator(args);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: strategy.ttl,
      channel,
      size: this.calculateSize(data)
    };

    // Apply compression if needed
    if (strategy.compressionThreshold && entry.size > strategy.compressionThreshold) {
      entry.data = await this.compress(data);
      entry.compressed = true;
    }

    // Store in appropriate cache layers
    if (strategy.layer === 'memory' || strategy.layer === 'both') {
      this.setInMemoryCache(key, entry, strategy);
    }

    if (strategy.layer === 'persistent' || strategy.layer === 'both') {
      await this.persistentCache.set(key, entry);
    }
  }

  async invalidate(patterns: string[]): Promise<void> {
    const keysToInvalidate = new Set<string>();

    // Find all strategies affected by the invalidation patterns
    for (const [channel, strategy] of this.cacheStrategies.entries()) {
      if (strategy.invalidateOn?.some(pattern => patterns.includes(pattern))) {
        // Collect all cache keys for this channel
        const channelKeys = this.getKeysForChannel(channel);
        channelKeys.forEach(key => keysToInvalidate.add(key));
      }
    }

    // Remove from memory cache
    for (const key of keysToInvalidate) {
      this.memoryCache.delete(key);
    }

    // Remove from persistent cache
    if (keysToInvalidate.size > 0) {
      await this.persistentCache.deleteMany([...keysToInvalidate]);
    }
  }
}
```

---

## 8. PERFORMANCE MONITORING & METRICS

### 8.1 Performance Monitoring System

```typescript
/**
 * Comprehensive IPC performance monitoring
 */
export class IPCPerformanceMonitor {
  private readonly metrics = new Map<string, ChannelMetrics>();
  private readonly realTimeMetrics: RealTimeMetrics;
  
  constructor() {
    this.realTimeMetrics = {
      activeRequests: 0,
      queuedRequests: 0,
      errorRate: 0,
      averageResponseTime: 0,
      throughputPerSecond: 0,
      memoryUsage: 0
    };
    
    // Start background monitoring
    this.startBackgroundMonitoring();
  }

  recordRequest(channel: string, startTime: number, endTime: number, success: boolean): void {
    const executionTime = endTime - startTime;
    
    let channelMetrics = this.metrics.get(channel);
    if (!channelMetrics) {
      channelMetrics = this.createChannelMetrics();
      this.metrics.set(channel, channelMetrics);
    }

    // Update channel-specific metrics
    channelMetrics.totalRequests++;
    channelMetrics.totalExecutionTime += executionTime;
    channelMetrics.averageExecutionTime = channelMetrics.totalExecutionTime / channelMetrics.totalRequests;
    
    if (success) {
      channelMetrics.successCount++;
    } else {
      channelMetrics.errorCount++;
    }
    
    channelMetrics.errorRate = (channelMetrics.errorCount / channelMetrics.totalRequests) * 100;
    
    // Update percentiles
    this.updatePercentiles(channelMetrics, executionTime);
    
    // Update real-time metrics
    this.updateRealTimeMetrics();
  }

  generatePerformanceReport(): PerformanceReport {
    const channelReports = Array.from(this.metrics.entries()).map(([channel, metrics]) => ({
      channel,
      ...metrics,
      healthScore: this.calculateHealthScore(metrics)
    }));

    return {
      timestamp: Date.now(),
      realTimeMetrics: { ...this.realTimeMetrics },
      channelReports,
      systemHealth: this.calculateSystemHealth(channelReports),
      recommendations: this.generateRecommendations(channelReports)
    };
  }

  private calculateHealthScore(metrics: ChannelMetrics): number {
    const errorWeight = 0.4;
    const performanceWeight = 0.4;
    const throughputWeight = 0.2;

    // Error score (0-100, 100 is best)
    const errorScore = Math.max(0, 100 - metrics.errorRate);

    // Performance score based on average execution time
    const performanceScore = metrics.averageExecutionTime < 100 ? 100 :
                           metrics.averageExecutionTime < 500 ? 80 :
                           metrics.averageExecutionTime < 1000 ? 60 :
                           metrics.averageExecutionTime < 2000 ? 40 : 20;

    // Throughput score (normalized)
    const throughputScore = Math.min(100, (metrics.totalRequests / 1000) * 100);

    return (errorScore * errorWeight) + 
           (performanceScore * performanceWeight) + 
           (throughputScore * throughputWeight);
  }

  private generateRecommendations(channelReports: any[]): string[] {
    const recommendations: string[] = [];

    channelReports.forEach(report => {
      if (report.errorRate > 5) {
        recommendations.push(`High error rate detected in ${report.channel} (${report.errorRate.toFixed(1)}%). Consider reviewing error handling.`);
      }

      if (report.averageExecutionTime > 1000) {
        recommendations.push(`Slow performance in ${report.channel} (${report.averageExecutionTime.toFixed(0)}ms average). Consider optimizing or caching.`);
      }

      if (report.p95ExecutionTime > 2000) {
        recommendations.push(`High P95 latency in ${report.channel} (${report.p95ExecutionTime.toFixed(0)}ms). Check for outliers.`);
      }
    });

    return recommendations;
  }
}
```

---

## 9. IMPLEMENTATION ROADMAP

### 9.1 Phase 1: Core IPC Foundation (Week 1-2)
- ✅ Implement base IPC manager with type safety
- ✅ Create channel registry and validation
- ✅ Implement basic error handling
- ✅ Set up security layer with input sanitization
- ✅ Create comprehensive type definitions

### 9.2 Phase 2: Performance Optimization (Week 3-4)
- 🔄 Implement request batching system
- 🔄 Add multi-layer caching with TTL
- 🔄 Create streaming handler for large datasets
- 🔄 Implement rate limiting
- 🔄 Add performance monitoring

### 9.3 Phase 3: Advanced Features (Week 5-6)
- ⏳ Add graceful degradation and retry logic
- ⏳ Implement comprehensive logging
- ⏳ Create development tools and debugging
- ⏳ Add real-time metrics dashboard
- ⏳ Implement cache invalidation strategies

### 9.4 Phase 4: Testing & Hardening (Week 7-8)
- ⏳ Comprehensive unit and integration tests
- ⏳ Security penetration testing
- ⏳ Performance benchmarking
- ⏳ Documentation and examples
- ⏳ Production deployment preparation

---

## 10. PRODUCTION DEPLOYMENT CHECKLIST

### 10.1 Security Checklist
- [ ] All channels validated against whitelist
- [ ] Input sanitization implemented for all data types
- [ ] Rate limiting configured for all channels
- [ ] Schema validation using Zod for all inputs
- [ ] Error messages sanitized (no sensitive information leakage)
- [ ] Audit logging implemented for security events

### 10.2 Performance Checklist
- [ ] Batching enabled for high-frequency operations
- [ ] Caching strategies defined for all read operations
- [ ] Memory usage monitoring implemented
- [ ] Performance thresholds configured
- [ ] Alerting set up for performance degradation
- [ ] Database connection pooling optimized

### 10.3 Reliability Checklist
- [ ] Graceful degradation strategies implemented
- [ ] Retry logic with exponential backoff
- [ ] Circuit breaker patterns for external services
- [ ] Comprehensive error handling and logging
- [ ] Health check endpoints implemented
- [ ] Monitoring and alerting configured

### 10.4 Maintainability Checklist
- [ ] Complete TypeScript type coverage
- [ ] Comprehensive documentation
- [ ] Unit tests (>90% coverage)
- [ ] Integration tests for all channels
- [ ] Performance benchmarks established
- [ ] Development tools and debugging aids

---

## CONCLUSION

This IPC architecture provides a robust, secure, and performant foundation for the Mainframe Knowledge Base Assistant. The design emphasizes:

1. **Security**: Through channel whitelisting, input validation, and sanitization
2. **Performance**: Via intelligent batching, caching, and streaming
3. **Reliability**: With comprehensive error handling and graceful degradation
4. **Maintainability**: Through strong typing and modular design
5. **Scalability**: Supporting future MVP requirements with minimal changes

The architecture is production-ready and follows Electron best practices while providing the flexibility needed for the application's progressive development approach.

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Author**: System Architect Agent  
**Review Status**: Ready for Implementation