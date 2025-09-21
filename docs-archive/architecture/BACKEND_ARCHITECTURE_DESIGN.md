# Backend Component Architecture Design
## Mainframe KB Assistant - Comprehensive Backend Systems

### Overview

This document provides a comprehensive backend component architecture for the Mainframe KB Assistant, building upon the existing Knowledge-First approach and progressive MVP structure. The architecture emphasizes modularity, performance, extensibility, and robust error handling.

## 1. Core Architecture Principles

### 1.1 Layered Architecture
```
┌─────────────────────────────────────────┐
│              API Layer                   │  ← Electron IPC, REST endpoints
├─────────────────────────────────────────┤
│           Service Layer                  │  ← Business logic, orchestration
├─────────────────────────────────────────┤
│          Repository Layer               │  ← Data access abstractions
├─────────────────────────────────────────┤
│           Database Layer                │  ← SQLite, caching, persistence
└─────────────────────────────────────────┘
```

### 1.2 Component Design Goals
- **Modularity**: Each component has a single responsibility
- **Testability**: Components are easily mockable and testable
- **Performance**: Optimized for <1s response times (MVP1 requirement)
- **Extensibility**: Plugin system for MVP evolution
- **Resilience**: Circuit breakers, fallbacks, graceful degradation

## 2. Enhanced Service Layer Architecture

### 2.1 Core Service Interfaces

```typescript
// src/backend/core/interfaces/ServiceInterfaces.ts
export interface IBaseService {
  readonly name: string;
  readonly version: string;
  readonly dependencies: string[];
  readonly healthCheck: () => Promise<ServiceHealth>;

  initialize(context: ServiceContext): Promise<void>;
  shutdown(): Promise<void>;

  // Performance monitoring
  getMetrics(): ServiceMetrics;
  resetMetrics(): void;
}

export interface IKnowledgeService extends IBaseService {
  // Core KB operations
  create(entry: CreateKBEntry): Promise<OperationResult<KBEntry>>;
  update(id: string, updates: UpdateKBEntry): Promise<OperationResult<KBEntry>>;
  findById(id: string): Promise<OperationResult<KBEntry>>;
  search(query: SearchQuery): Promise<OperationResult<SearchResult[]>>;
  delete(id: string): Promise<OperationResult<void>>;

  // Batch operations for performance
  bulkCreate(entries: CreateKBEntry[]): Promise<OperationResult<string[]>>;
  bulkUpdate(updates: Array<{id: string, data: UpdateKBEntry}>): Promise<OperationResult<void>>;

  // Statistics and analytics
  getStatistics(): Promise<OperationResult<KBStatistics>>;
  getPopularEntries(limit?: number): Promise<OperationResult<SearchResult[]>>;
  getRecentActivity(): Promise<OperationResult<ActivitySummary>>;
}

export interface ICacheService extends IBaseService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;

  // Advanced caching features
  mget(keys: string[]): Promise<Array<any | null>>;
  mset(items: Array<{key: string, value: any, ttl?: number}>): Promise<void>;
  invalidatePattern(pattern: string): Promise<number>;

  // Cache statistics
  getStats(): CacheStatistics;
  getHitRate(): number;
}

export interface ISearchService extends IBaseService {
  search(query: string, options?: SearchOptions): Promise<OperationResult<SearchResult[]>>;
  autocomplete(partial: string, limit?: number): Promise<OperationResult<string[]>>;
  indexEntry(entry: KBEntry): Promise<OperationResult<void>>;
  removeFromIndex(entryId: string): Promise<OperationResult<void>>;

  // Advanced search features
  fuzzySearch(query: string, threshold?: number): Promise<OperationResult<SearchResult[]>>;
  semanticSearch(query: string, useAI?: boolean): Promise<OperationResult<SearchResult[]>>;
  searchWithFacets(query: string): Promise<OperationResult<SearchWithFacets>>;
}
```

### 2.2 Enhanced Service Implementations

```typescript
// src/backend/services/enhanced/EnhancedKnowledgeService.ts
import { IKnowledgeService, ServiceMetrics, OperationResult } from '../interfaces';
import { CircuitBreaker, RetryPolicy, RateLimiter } from '../middleware';
import { PerformanceMonitor } from '../monitoring';

export class EnhancedKnowledgeService implements IKnowledgeService {
  private readonly repository: IKnowledgeBaseRepository;
  private readonly cache: ICacheService;
  private readonly validator: IValidationService;
  private readonly metrics: PerformanceMonitor;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryPolicy: RetryPolicy;
  private readonly rateLimiter: RateLimiter;

  constructor(
    repository: IKnowledgeBaseRepository,
    cache: ICacheService,
    validator: IValidationService,
    options: ServiceOptions = {}
  ) {
    this.repository = repository;
    this.cache = cache;
    this.validator = validator;
    this.metrics = new PerformanceMonitor('knowledge-service');

    // Initialize resilience patterns
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 30000,
      monitorWindow: 60000
    });

    this.retryPolicy = new RetryPolicy({
      maxAttempts: 3,
      backoffStrategy: 'exponential',
      baseDelay: 1000
    });

    this.rateLimiter = new RateLimiter({
      maxRequests: 100,
      windowMs: 60000,
      skipSuccessfulRequests: false
    });
  }

  async create(entry: CreateKBEntry): Promise<OperationResult<KBEntry>> {
    return this.executeWithResilience('create', async () => {
      // Validate input
      const validationResult = await this.validator.validateCreateEntry(entry);
      if (!validationResult.isValid) {
        return OperationResult.failure(
          new ValidationError('Invalid entry data', validationResult.errors)
        );
      }

      // Check for duplicates
      const duplicateCheck = await this.checkForDuplicates(entry);
      if (duplicateCheck.isDuplicate) {
        return OperationResult.failure(
          new BusinessError('Duplicate entry detected', {
            similarEntries: duplicateCheck.similarEntries
          })
        );
      }

      // Create entry
      const result = await this.repository.create(validationResult.data);

      if (result.success) {
        // Update cache
        await this.cache.set(`entry:${result.data!.id}`, result.data, 3600);

        // Update search index
        await this.indexEntry(result.data!);

        // Record metrics
        this.metrics.recordOperation('create', true, Date.now() - startTime);

        return OperationResult.success(result.data!);
      } else {
        this.metrics.recordOperation('create', false, Date.now() - startTime);
        return OperationResult.failure(result.error!);
      }
    });
  }

  async search(query: SearchQuery): Promise<OperationResult<SearchResult[]>> {
    const startTime = Date.now();

    return this.executeWithResilience('search', async () => {
      // Check rate limiting
      if (!await this.rateLimiter.checkLimit('search', query.userId)) {
        return OperationResult.failure(
          new RateLimitError('Search rate limit exceeded')
        );
      }

      // Try cache first
      const cacheKey = this.generateSearchCacheKey(query);
      const cachedResult = await this.cache.get<SearchResult[]>(cacheKey);

      if (cachedResult) {
        this.metrics.recordCacheHit('search');
        return OperationResult.success(cachedResult);
      }

      // Execute search
      const searchResult = await this.repository.search(query);

      if (searchResult.success) {
        // Cache results for 5 minutes
        await this.cache.set(cacheKey, searchResult.data!, 300);

        // Record search analytics
        await this.recordSearchAnalytics(query, searchResult.data!);

        this.metrics.recordOperation('search', true, Date.now() - startTime);
        this.metrics.recordCacheMiss('search');

        return OperationResult.success(searchResult.data!);
      } else {
        this.metrics.recordOperation('search', false, Date.now() - startTime);
        return OperationResult.failure(searchResult.error!);
      }
    });
  }

  private async executeWithResilience<T>(
    operation: string,
    callback: () => Promise<OperationResult<T>>
  ): Promise<OperationResult<T>> {
    try {
      return await this.circuitBreaker.execute(
        () => this.retryPolicy.execute(callback)
      );
    } catch (error) {
      this.metrics.recordError(operation, error);
      return OperationResult.failure(
        new ServiceError(`Operation ${operation} failed`, error)
      );
    }
  }
}
```

## 3. Advanced Repository Patterns

### 3.1 Repository Factory Pattern

```typescript
// src/backend/repositories/RepositoryFactory.ts
export class RepositoryFactory {
  private readonly connections: Map<string, Database.Database>;
  private readonly repositories: Map<string, any>;
  private readonly config: RepositoryConfig;

  constructor(config: RepositoryConfig) {
    this.connections = new Map();
    this.repositories = new Map();
    this.config = config;
  }

  async createKnowledgeBaseRepository(): Promise<IKnowledgeBaseRepository> {
    const connection = await this.getOrCreateConnection('knowledge');

    return new CachedKnowledgeBaseRepository(
      new OptimizedKnowledgeBaseRepository(connection),
      await this.getCacheService()
    );
  }

  async createPatternRepository(): Promise<IPatternRepository> {
    const connection = await this.getOrCreateConnection('patterns');
    return new PatternRepository(connection);
  }

  private async getOrCreateConnection(name: string): Promise<Database.Database> {
    if (!this.connections.has(name)) {
      const dbPath = this.config.databases[name].path;
      const db = new Database(dbPath, {
        readonly: false,
        fileMustExist: false,
        timeout: 5000,
        verbose: this.config.logging.queryLogging ? console.log : undefined
      });

      // Apply performance optimizations
      await this.optimizeDatabase(db);

      this.connections.set(name, db);
    }

    return this.connections.get(name)!;
  }

  private async optimizeDatabase(db: Database.Database): Promise<void> {
    const pragmas = {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      cache_size: -64000, // 64MB cache
      foreign_keys: 'ON',
      mmap_size: 134217728, // 128MB
      temp_store: 'MEMORY'
    };

    Object.entries(pragmas).forEach(([key, value]) => {
      db.pragma(`${key} = ${value}`);
    });
  }
}
```

### 3.2 Cached Repository Decorator

```typescript
// src/backend/repositories/decorators/CachedRepository.ts
export class CachedKnowledgeBaseRepository implements IKnowledgeBaseRepository {
  private readonly repository: IKnowledgeBaseRepository;
  private readonly cache: ICacheService;
  private readonly cacheConfig: CacheConfig;

  constructor(
    repository: IKnowledgeBaseRepository,
    cache: ICacheService,
    cacheConfig: CacheConfig = DEFAULT_CACHE_CONFIG
  ) {
    this.repository = repository;
    this.cache = cache;
    this.cacheConfig = cacheConfig;
  }

  async findById(id: string): Promise<RepositoryResult<KBEntry>> {
    const cacheKey = `kb:entry:${id}`;

    // Try cache first
    const cached = await this.cache.get<KBEntry>(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached,
        metadata: { executionTime: 0, cacheHit: true }
      };
    }

    // Fallback to repository
    const result = await this.repository.findById(id);

    if (result.success && result.data) {
      // Cache successful results
      await this.cache.set(cacheKey, result.data, this.cacheConfig.entryTtl);
    }

    return {
      ...result,
      metadata: { ...result.metadata, cacheHit: false }
    };
  }

  async search(query: SearchQuery): Promise<RepositoryResult<SearchResult[]>> {
    const cacheKey = this.generateSearchCacheKey(query);

    // Check cache for search results
    if (this.cacheConfig.cacheSearchResults) {
      const cached = await this.cache.get<SearchResult[]>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: { executionTime: 0, cacheHit: true }
        };
      }
    }

    // Execute search
    const result = await this.repository.search(query);

    if (result.success && this.cacheConfig.cacheSearchResults) {
      // Cache search results for shorter time
      await this.cache.set(cacheKey, result.data!, this.cacheConfig.searchTtl);
    }

    return {
      ...result,
      metadata: { ...result.metadata, cacheHit: false }
    };
  }

  async create(data: CreateKBEntry): Promise<RepositoryResult<KBEntry>> {
    const result = await this.repository.create(data);

    if (result.success && result.data) {
      // Cache the new entry
      const cacheKey = `kb:entry:${result.data.id}`;
      await this.cache.set(cacheKey, result.data, this.cacheConfig.entryTtl);

      // Invalidate related search caches
      await this.invalidateSearchCaches(result.data);
    }

    return result;
  }

  private async invalidateSearchCaches(entry: KBEntry): Promise<void> {
    const patterns = [
      `search:*:${entry.category.toLowerCase()}:*`,
      `search:autocomplete:*`,
      `search:facets:*`
    ];

    for (const pattern of patterns) {
      await this.cache.invalidatePattern(pattern);
    }
  }
}
```

## 4. API Endpoint Architecture

### 4.1 IPC Handler System

```typescript
// src/backend/api/handlers/BaseHandler.ts
export abstract class BaseIPCHandler {
  protected readonly validator: IValidationService;
  protected readonly metrics: IMetricsService;
  protected readonly logger: ILogger;

  constructor(
    validator: IValidationService,
    metrics: IMetricsService,
    logger: ILogger
  ) {
    this.validator = validator;
    this.metrics = metrics;
    this.logger = logger;
  }

  protected async executeHandler<T>(
    operation: string,
    handler: () => Promise<T>
  ): Promise<IPCResponse<T>> {
    const startTime = Date.now();
    const operationId = generateOperationId();

    try {
      this.logger.info(`Starting operation: ${operation}`, { operationId });

      const result = await handler();
      const duration = Date.now() - startTime;

      this.metrics.recordOperation(operation, 'success', duration);
      this.logger.info(`Operation completed: ${operation}`, {
        operationId,
        duration
      });

      return {
        success: true,
        data: result,
        metadata: {
          operationId,
          duration,
          timestamp: new Date()
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.metrics.recordOperation(operation, 'error', duration);
      this.logger.error(`Operation failed: ${operation}`, error, {
        operationId,
        duration
      });

      return {
        success: false,
        error: {
          code: error.code || 'UNKNOWN_ERROR',
          message: error.message,
          details: error.details || {},
          operationId
        },
        metadata: {
          operationId,
          duration,
          timestamp: new Date()
        }
      };
    }
  }
}

// src/backend/api/handlers/KnowledgeBaseHandler.ts
export class KnowledgeBaseHandler extends BaseIPCHandler {
  private readonly knowledgeService: IKnowledgeService;

  constructor(
    knowledgeService: IKnowledgeService,
    validator: IValidationService,
    metrics: IMetricsService,
    logger: ILogger
  ) {
    super(validator, metrics, logger);
    this.knowledgeService = knowledgeService;
  }

  async handleSearch(request: IPCRequest<SearchRequest>): Promise<IPCResponse<SearchResult[]>> {
    return this.executeHandler('kb.search', async () => {
      const validatedRequest = await this.validator.validateSearchRequest(request.data);

      if (!validatedRequest.isValid) {
        throw new ValidationError('Invalid search request', validatedRequest.errors);
      }

      const result = await this.knowledgeService.search(validatedRequest.data);

      if (!result.success) {
        throw result.error;
      }

      return result.data!;
    });
  }

  async handleCreate(request: IPCRequest<CreateKBEntry>): Promise<IPCResponse<KBEntry>> {
    return this.executeHandler('kb.create', async () => {
      const validatedRequest = await this.validator.validateCreateEntry(request.data);

      if (!validatedRequest.isValid) {
        throw new ValidationError('Invalid entry data', validatedRequest.errors);
      }

      const result = await this.knowledgeService.create(validatedRequest.data);

      if (!result.success) {
        throw result.error;
      }

      return result.data!;
    });
  }

  async handleBulkCreate(request: IPCRequest<BulkCreateRequest>): Promise<IPCResponse<string[]>> {
    return this.executeHandler('kb.bulkCreate', async () => {
      const { entries, batchSize = 50 } = request.data;

      // Process in batches to avoid memory issues
      const batches = this.chunkArray(entries, batchSize);
      const results: string[] = [];

      for (const batch of batches) {
        const result = await this.knowledgeService.bulkCreate(batch);
        if (!result.success) {
          throw result.error;
        }
        results.push(...result.data!);
      }

      return results;
    });
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

### 4.2 Handler Registry System

```typescript
// src/backend/api/HandlerRegistry.ts
export class HandlerRegistry {
  private readonly handlers: Map<string, BaseIPCHandler>;
  private readonly middleware: IPCMiddleware[];

  constructor() {
    this.handlers = new Map();
    this.middleware = [];
  }

  register(channel: string, handler: BaseIPCHandler): void {
    this.handlers.set(channel, handler);
  }

  use(middleware: IPCMiddleware): void {
    this.middleware.push(middleware);
  }

  async handle(channel: string, request: IPCRequest<any>): Promise<IPCResponse<any>> {
    const handler = this.handlers.get(channel);

    if (!handler) {
      return {
        success: false,
        error: {
          code: 'HANDLER_NOT_FOUND',
          message: `No handler registered for channel: ${channel}`,
          details: { channel }
        }
      };
    }

    // Apply middleware chain
    let processedRequest = request;
    for (const middleware of this.middleware) {
      processedRequest = await middleware.process(processedRequest);
    }

    // Execute handler
    const methodName = `handle${this.capitalize(channel.split('.')[1])}`;
    const handlerMethod = (handler as any)[methodName];

    if (!handlerMethod) {
      return {
        success: false,
        error: {
          code: 'METHOD_NOT_FOUND',
          message: `Handler method not found: ${methodName}`,
          details: { channel, method: methodName }
        }
      };
    }

    return handlerMethod.call(handler, processedRequest);
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
```

## 5. Middleware Architecture

### 5.1 Core Middleware Components

```typescript
// src/backend/middleware/PerformanceMiddleware.ts
export class PerformanceMiddleware implements IPCMiddleware {
  private readonly metrics: IMetricsService;
  private readonly slowQueryThreshold: number;

  constructor(metrics: IMetricsService, slowQueryThreshold = 1000) {
    this.metrics = metrics;
    this.slowQueryThreshold = slowQueryThreshold;
  }

  async process(request: IPCRequest<any>): Promise<IPCRequest<any>> {
    const startTime = Date.now();

    // Add timing metadata
    request.metadata = {
      ...request.metadata,
      startTime,
      performanceTracing: true
    };

    // Set up post-processing
    request.metadata.onComplete = (response: IPCResponse<any>) => {
      const duration = Date.now() - startTime;

      this.metrics.recordRequestDuration(request.channel, duration);

      if (duration > this.slowQueryThreshold) {
        this.metrics.recordSlowQuery(request.channel, duration, {
          requestId: request.metadata?.requestId,
          data: request.data
        });
      }
    };

    return request;
  }
}

// src/backend/middleware/SecurityMiddleware.ts
export class SecurityMiddleware implements IPCMiddleware {
  private readonly rateLimiter: RateLimiter;
  private readonly inputSanitizer: InputSanitizer;

  constructor(rateLimiter: RateLimiter, inputSanitizer: InputSanitizer) {
    this.rateLimiter = rateLimiter;
    this.inputSanitizer = inputSanitizer;
  }

  async process(request: IPCRequest<any>): Promise<IPCRequest<any>> {
    // Rate limiting
    const clientId = request.metadata?.clientId || 'anonymous';
    if (!await this.rateLimiter.checkLimit(request.channel, clientId)) {
      throw new RateLimitError('Rate limit exceeded for channel: ' + request.channel);
    }

    // Input sanitization
    if (request.data) {
      request.data = this.inputSanitizer.sanitize(request.data);
    }

    // Add security headers/metadata
    request.metadata = {
      ...request.metadata,
      securityValidated: true,
      sanitized: true
    };

    return request;
  }
}

// src/backend/middleware/ValidationMiddleware.ts
export class ValidationMiddleware implements IPCMiddleware {
  private readonly validator: IValidationService;
  private readonly schemas: Map<string, ValidationSchema>;

  constructor(validator: IValidationService) {
    this.validator = validator;
    this.schemas = new Map();
  }

  registerSchema(channel: string, schema: ValidationSchema): void {
    this.schemas.set(channel, schema);
  }

  async process(request: IPCRequest<any>): Promise<IPCRequest<any>> {
    const schema = this.schemas.get(request.channel);

    if (schema) {
      const result = await this.validator.validate(request.data, schema);

      if (!result.isValid) {
        throw new ValidationError('Request validation failed', result.errors);
      }

      request.data = result.data; // Use validated/transformed data
    }

    request.metadata = {
      ...request.metadata,
      validated: true
    };

    return request;
  }
}
```

### 5.2 Plugin Architecture

```typescript
// src/backend/plugins/PluginManager.ts
export class PluginManager {
  private readonly plugins: Map<string, IPlugin>;
  private readonly hooks: Map<string, IPlugin[]>;
  private readonly config: PluginConfig;

  constructor(config: PluginConfig) {
    this.plugins = new Map();
    this.hooks = new Map();
    this.config = config;
  }

  async loadPlugin(pluginName: string, pluginConfig: any): Promise<void> {
    const pluginPath = this.resolvePluginPath(pluginName);
    const PluginClass = await import(pluginPath);

    const plugin = new PluginClass.default(pluginConfig);

    // Validate plugin interface
    if (!this.validatePlugin(plugin)) {
      throw new Error(`Invalid plugin: ${pluginName}`);
    }

    // Initialize plugin
    await plugin.initialize();

    this.plugins.set(pluginName, plugin);

    // Register hooks
    const hooks = plugin.getHooks();
    hooks.forEach(hookName => {
      if (!this.hooks.has(hookName)) {
        this.hooks.set(hookName, []);
      }
      this.hooks.get(hookName)!.push(plugin);
    });
  }

  async executeHook<T>(hookName: string, data: T): Promise<T> {
    const plugins = this.hooks.get(hookName) || [];

    let result = data;
    for (const plugin of plugins) {
      result = await plugin.executeHook(hookName, result);
    }

    return result;
  }

  async executeHookParallel<T>(hookName: string, data: T): Promise<T[]> {
    const plugins = this.hooks.get(hookName) || [];

    const promises = plugins.map(plugin =>
      plugin.executeHook(hookName, data)
    );

    return Promise.all(promises);
  }

  private validatePlugin(plugin: any): plugin is IPlugin {
    return (
      typeof plugin.initialize === 'function' &&
      typeof plugin.shutdown === 'function' &&
      typeof plugin.getHooks === 'function' &&
      typeof plugin.executeHook === 'function'
    );
  }
}

// Example Plugin: Pattern Detection Plugin
// src/backend/plugins/PatternDetectionPlugin.ts
export class PatternDetectionPlugin implements IPlugin {
  private patternService: IPatternService;

  constructor(config: PatternPluginConfig) {
    this.patternService = new PatternService(config);
  }

  async initialize(): Promise<void> {
    await this.patternService.initialize();
  }

  async shutdown(): Promise<void> {
    await this.patternService.shutdown();
  }

  getHooks(): string[] {
    return ['kb.entry.created', 'search.completed', 'feedback.received'];
  }

  async executeHook(hookName: string, data: any): Promise<any> {
    switch (hookName) {
      case 'kb.entry.created':
        await this.onEntryCreated(data);
        break;
      case 'search.completed':
        await this.onSearchCompleted(data);
        break;
      case 'feedback.received':
        await this.onFeedbackReceived(data);
        break;
    }
    return data;
  }

  private async onEntryCreated(entry: KBEntry): Promise<void> {
    // Analyze entry for patterns
    await this.patternService.analyzeEntry(entry);
  }

  private async onSearchCompleted(searchData: SearchData): Promise<void> {
    // Track search patterns
    await this.patternService.recordSearchPattern(searchData);
  }
}
```

## 6. Caching Strategies

### 6.1 Multi-Layer Cache Architecture

```typescript
// src/backend/cache/MultiLayerCache.ts
export class MultiLayerCache implements ICacheService {
  private readonly layers: CacheLayer[];
  private readonly config: CacheConfig;
  private readonly metrics: CacheMetrics;

  constructor(config: CacheConfig) {
    this.config = config;
    this.metrics = new CacheMetrics();
    this.layers = this.initializeLayers();
  }

  private initializeLayers(): CacheLayer[] {
    const layers: CacheLayer[] = [];

    // L1: Memory cache (fastest, smallest)
    layers.push(new MemoryCacheLayer({
      maxSize: 1000,
      ttl: 60000, // 1 minute
      algorithm: 'lru'
    }));

    // L2: SQLite cache (medium speed, medium size)
    if (this.config.enablePersistentCache) {
      layers.push(new SQLiteCacheLayer({
        dbPath: this.config.cacheDbPath,
        maxSize: 10000,
        ttl: 3600000, // 1 hour
        compressionLevel: 1
      }));
    }

    // L3: File system cache (slowest, largest)
    if (this.config.enableFileCache) {
      layers.push(new FileSystemCacheLayer({
        basePath: this.config.fileCachePath,
        maxSize: 100000,
        ttl: 86400000, // 24 hours
        compression: true
      }));
    }

    return layers;
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const value = await layer.get<T>(key);

      if (value !== null) {
        this.metrics.recordHit(`L${i + 1}`);

        // Populate higher layers (cache promotion)
        for (let j = 0; j < i; j++) {
          await this.layers[j].set(key, value, layer.getTtl(key));
        }

        this.metrics.recordLatency('get', Date.now() - startTime);
        return value;
      }
    }

    this.metrics.recordMiss();
    this.metrics.recordLatency('get', Date.now() - startTime);
    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = Date.now();

    // Set in all layers
    await Promise.all(
      this.layers.map(layer => layer.set(key, value, ttl))
    );

    this.metrics.recordLatency('set', Date.now() - startTime);
  }

  async invalidatePattern(pattern: string): Promise<number> {
    let totalInvalidated = 0;

    for (const layer of this.layers) {
      totalInvalidated += await layer.invalidatePattern(pattern);
    }

    this.metrics.recordInvalidation(totalInvalidated);
    return totalInvalidated;
  }
}
```

### 6.2 Cache Invalidation Strategies

```typescript
// src/backend/cache/InvalidationManager.ts
export class CacheInvalidationManager {
  private readonly cache: ICacheService;
  private readonly rules: InvalidationRule[];
  private readonly eventBus: IEventBus;

  constructor(cache: ICacheService, eventBus: IEventBus) {
    this.cache = cache;
    this.rules = [];
    this.eventBus = eventBus;
    this.setupEventListeners();
  }

  addRule(rule: InvalidationRule): void {
    this.rules.push(rule);
  }

  private setupEventListeners(): void {
    this.eventBus.on('kb.entry.created', async (entry: KBEntry) => {
      await this.invalidateByTags(['search:*', `category:${entry.category}:*`]);
    });

    this.eventBus.on('kb.entry.updated', async (entry: KBEntry) => {
      await this.invalidateByTags([
        `entry:${entry.id}`,
        'search:*',
        `category:${entry.category}:*`
      ]);
    });

    this.eventBus.on('kb.entry.deleted', async (entryId: string) => {
      await this.invalidateByTags([`entry:${entryId}`, 'search:*']);
    });
  }

  private async invalidateByTags(tags: string[]): Promise<void> {
    for (const tag of tags) {
      await this.cache.invalidatePattern(tag);
    }
  }
}

// Cache warming strategy
// src/backend/cache/CacheWarmer.ts
export class CacheWarmer {
  private readonly cache: ICacheService;
  private readonly knowledgeService: IKnowledgeService;
  private readonly config: CacheWarmingConfig;

  constructor(
    cache: ICacheService,
    knowledgeService: IKnowledgeService,
    config: CacheWarmingConfig
  ) {
    this.cache = cache;
    this.knowledgeService = knowledgeService;
    this.config = config;
  }

  async warmCache(): Promise<void> {
    console.log('Starting cache warming...');

    // Warm popular entries
    await this.warmPopularEntries();

    // Warm common search queries
    await this.warmCommonSearches();

    // Warm category statistics
    await this.warmStatistics();

    console.log('Cache warming completed');
  }

  private async warmPopularEntries(): Promise<void> {
    const popular = await this.knowledgeService.getPopularEntries(50);

    if (popular.success) {
      for (const result of popular.data!) {
        await this.cache.set(
          `entry:${result.entry.id}`,
          result.entry,
          this.config.entryTtl
        );
      }
    }
  }

  private async warmCommonSearches(): Promise<void> {
    const commonQueries = [
      'S0C7', 'VSAM', 'JCL error', 'database', 'timeout',
      'abend', 'status code', 'file not found'
    ];

    for (const query of commonQueries) {
      const results = await this.knowledgeService.search({ query, limit: 10 });

      if (results.success) {
        await this.cache.set(
          `search:${this.generateSearchKey(query)}`,
          results.data!,
          this.config.searchTtl
        );
      }
    }
  }
}
```

## 7. Performance Optimization Components

### 7.1 Database Query Optimization

```typescript
// src/backend/optimization/QueryOptimizer.ts
export class QueryOptimizer {
  private readonly db: Database.Database;
  private readonly queryStats: QueryStatistics;
  private readonly config: OptimizationConfig;

  constructor(db: Database.Database, config: OptimizationConfig) {
    this.db = db;
    this.queryStats = new QueryStatistics();
    this.config = config;
  }

  async optimizeQuery(sql: string, params: any[]): Promise<{
    optimizedSql: string;
    optimizedParams: any[];
    estimatedCost: number;
  }> {
    // Analyze query pattern
    const queryPattern = this.analyzeQueryPattern(sql);

    // Apply optimization rules
    let optimizedSql = sql;
    let optimizedParams = params;

    // Rule 1: Add index hints for FTS queries
    if (queryPattern.isFtsQuery) {
      optimizedSql = this.addFtsOptimizations(optimizedSql);
    }

    // Rule 2: Optimize JOIN order
    if (queryPattern.hasJoins) {
      optimizedSql = this.optimizeJoinOrder(optimizedSql);
    }

    // Rule 3: Add LIMIT if missing for large result sets
    if (!queryPattern.hasLimit && queryPattern.estimatedRows > 1000) {
      optimizedSql += ' LIMIT 1000';
    }

    // Estimate query cost
    const estimatedCost = await this.estimateQueryCost(optimizedSql, optimizedParams);

    return {
      optimizedSql,
      optimizedParams,
      estimatedCost
    };
  }

  private addFtsOptimizations(sql: string): string {
    // Add BM25 ranking optimizations
    return sql.replace(
      /bm25\([^)]+\)/g,
      'bm25(kb_fts, 3.0, 2.0, 1.5, 1.0)'
    );
  }

  async createOptimalIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_kb_category_usage ON kb_entries(category, usage_count DESC)',
      'CREATE INDEX IF NOT EXISTS idx_kb_created_at ON kb_entries(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_kb_success_rate ON kb_entries((success_count + failure_count), success_count)',
      'CREATE INDEX IF NOT EXISTS idx_tags_entry_id ON kb_tags(entry_id, tag)',
      'CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp DESC)',
      'CREATE INDEX IF NOT EXISTS idx_usage_metrics_entry_action ON usage_metrics(entry_id, action, timestamp)'
    ];

    for (const index of indexes) {
      try {
        this.db.exec(index);
      } catch (error) {
        console.warn(`Failed to create index: ${index}`, error);
      }
    }
  }
}
```

### 7.2 Connection Pool Management

```typescript
// src/backend/database/ConnectionPool.ts
export class DatabaseConnectionPool {
  private readonly connections: Database.Database[];
  private readonly available: Database.Database[];
  private readonly inUse: Set<Database.Database>;
  private readonly config: ConnectionPoolConfig;
  private readonly metrics: PoolMetrics;

  constructor(config: ConnectionPoolConfig) {
    this.connections = [];
    this.available = [];
    this.inUse = new Set();
    this.config = config;
    this.metrics = new PoolMetrics();
  }

  async initialize(): Promise<void> {
    // Create initial connections
    for (let i = 0; i < this.config.minConnections; i++) {
      const connection = await this.createConnection();
      this.connections.push(connection);
      this.available.push(connection);
    }
  }

  async acquire(): Promise<PooledConnection> {
    const startTime = Date.now();

    // Try to get available connection
    let connection = this.available.pop();

    // Create new connection if needed and under max limit
    if (!connection && this.connections.length < this.config.maxConnections) {
      connection = await this.createConnection();
      this.connections.push(connection);
    }

    // Wait for available connection if at max capacity
    if (!connection) {
      connection = await this.waitForConnection();
    }

    this.inUse.add(connection);
    this.metrics.recordAcquisition(Date.now() - startTime);

    return new PooledConnection(connection, this);
  }

  async release(connection: Database.Database): Promise<void> {
    if (this.inUse.has(connection)) {
      this.inUse.delete(connection);

      // Check if connection is still healthy
      if (await this.isConnectionHealthy(connection)) {
        this.available.push(connection);
      } else {
        // Replace unhealthy connection
        await this.replaceConnection(connection);
      }

      this.metrics.recordRelease();
    }
  }

  private async isConnectionHealthy(connection: Database.Database): Promise<boolean> {
    try {
      connection.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  getMetrics(): PoolMetrics {
    return {
      ...this.metrics.getStats(),
      totalConnections: this.connections.length,
      availableConnections: this.available.length,
      inUseConnections: this.inUse.size
    };
  }
}

export class PooledConnection {
  private readonly connection: Database.Database;
  private readonly pool: DatabaseConnectionPool;
  private released: boolean = false;

  constructor(connection: Database.Database, pool: DatabaseConnectionPool) {
    this.connection = connection;
    this.pool = pool;
  }

  get db(): Database.Database {
    if (this.released) {
      throw new Error('Connection has been released');
    }
    return this.connection;
  }

  async release(): Promise<void> {
    if (!this.released) {
      this.released = true;
      await this.pool.release(this.connection);
    }
  }
}
```

## 8. Error Handling Patterns

### 8.1 Structured Error System

```typescript
// src/backend/errors/ErrorSystem.ts
export abstract class BaseError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: Date;
  readonly metadata: Record<string, any>;
  readonly operationId?: string;

  constructor(message: string, metadata: Record<string, any> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.metadata = metadata;
    this.operationId = metadata.operationId;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      metadata: this.metadata,
      operationId: this.operationId,
      stack: this.stack
    };
  }
}

export class ValidationError extends BaseError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  readonly errors: ValidationIssue[];

  constructor(message: string, errors: ValidationIssue[] = []) {
    super(message, { errors });
    this.errors = errors;
  }
}

export class BusinessError extends BaseError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
  readonly statusCode = 422;

  constructor(message: string, metadata: Record<string, any> = {}) {
    super(message, metadata);
  }
}

export class ServiceError extends BaseError {
  readonly code = 'SERVICE_ERROR';
  readonly statusCode = 500;
  readonly originalError?: Error;

  constructor(message: string, originalError?: Error, metadata: Record<string, any> = {}) {
    super(message, { ...metadata, originalError: originalError?.message });
    this.originalError = originalError;
  }
}
```

### 8.2 Circuit Breaker Implementation

```typescript
// src/backend/resilience/CircuitBreaker.ts
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private nextAttemptTime?: Date;

  constructor(private readonly config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < (this.nextAttemptTime?.getTime() || 0)) {
        throw new ServiceError('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
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
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = new Date(Date.now() + this.config.resetTimeout);
    }
  }

  getState(): { state: string; failureCount: number; lastFailureTime?: Date } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}
```

## 9. Monitoring and Metrics

### 9.1 Performance Monitoring System

```typescript
// src/backend/monitoring/PerformanceMonitor.ts
export class PerformanceMonitor {
  private readonly metrics: Map<string, PerformanceMetric>;
  private readonly alertManager: AlertManager;
  private readonly config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.metrics = new Map();
    this.alertManager = new AlertManager(config.alerts);
    this.config = config;
  }

  recordOperation(operation: string, success: boolean, duration: number): void {
    const key = `operation.${operation}`;
    let metric = this.metrics.get(key);

    if (!metric) {
      metric = new PerformanceMetric(key);
      this.metrics.set(key, metric);
    }

    metric.record(duration, success);

    // Check alerts
    this.checkAlerts(operation, metric);
  }

  recordCacheHit(operation: string): void {
    this.recordMetric(`cache.${operation}.hits`, 1);
  }

  recordCacheMiss(operation: string): void {
    this.recordMetric(`cache.${operation}.misses`, 1);
  }

  recordDatabaseQuery(query: string, duration: number, rowCount: number): void {
    this.recordOperation('database.query', true, duration);
    this.recordMetric('database.rows_returned', rowCount);

    // Track slow queries
    if (duration > this.config.slowQueryThreshold) {
      this.recordSlowQuery(query, duration);
    }
  }

  getMetrics(): PerformanceReport {
    const report: PerformanceReport = {
      timestamp: new Date(),
      operations: {},
      cache: {},
      database: {},
      system: {}
    };

    this.metrics.forEach((metric, key) => {
      const [category, ...nameParts] = key.split('.');
      const name = nameParts.join('.');

      if (!report[category as keyof PerformanceReport]) {
        (report[category as keyof PerformanceReport] as any) = {};
      }

      (report[category as keyof PerformanceReport] as any)[name] = metric.getStats();
    });

    return report;
  }

  private checkAlerts(operation: string, metric: PerformanceMetric): void {
    const stats = metric.getStats();

    // Check error rate alert
    if (stats.errorRate > this.config.alerts.errorRateThreshold) {
      this.alertManager.triggerAlert('HIGH_ERROR_RATE', {
        operation,
        errorRate: stats.errorRate,
        threshold: this.config.alerts.errorRateThreshold
      });
    }

    // Check latency alert
    if (stats.averageDuration > this.config.alerts.latencyThreshold) {
      this.alertManager.triggerAlert('HIGH_LATENCY', {
        operation,
        averageLatency: stats.averageDuration,
        threshold: this.config.alerts.latencyThreshold
      });
    }
  }
}

class PerformanceMetric {
  private readonly measurements: Array<{ duration: number; success: boolean; timestamp: Date }> = [];
  private readonly maxMeasurements = 1000;

  constructor(private readonly name: string) {}

  record(duration: number, success: boolean): void {
    this.measurements.push({
      duration,
      success,
      timestamp: new Date()
    });

    // Keep only recent measurements
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift();
    }
  }

  getStats(): MetricStats {
    if (this.measurements.length === 0) {
      return {
        count: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        errorRate: 0,
        successRate: 0,
        throughput: 0
      };
    }

    const durations = this.measurements.map(m => m.duration);
    const successCount = this.measurements.filter(m => m.success).length;

    // Calculate throughput (requests per second) over last minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentMeasurements = this.measurements.filter(
      m => m.timestamp.getTime() > oneMinuteAgo
    );

    return {
      count: this.measurements.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      errorRate: (this.measurements.length - successCount) / this.measurements.length,
      successRate: successCount / this.measurements.length,
      throughput: recentMeasurements.length / 60 // per second
    };
  }
}
```

## 10. Implementation Examples and Best Practices

### 10.1 Service Integration Example

```typescript
// src/backend/examples/ServiceIntegrationExample.ts
export class KBAssistantBackend {
  private readonly serviceManager: ServiceManager;
  private readonly handlerRegistry: HandlerRegistry;
  private readonly pluginManager: PluginManager;
  private readonly performanceMonitor: PerformanceMonitor;

  constructor(config: BackendConfig) {
    this.serviceManager = new ServiceManager(config.serviceManager);
    this.handlerRegistry = new HandlerRegistry();
    this.pluginManager = new PluginManager(config.plugins);
    this.performanceMonitor = new PerformanceMonitor(config.monitoring);

    this.setupServices();
    this.setupHandlers();
    this.setupMiddleware();
  }

  async initialize(): Promise<void> {
    // Initialize services in dependency order
    await this.serviceManager.initialize();

    // Load plugins
    await this.pluginManager.loadPlugins();

    // Setup monitoring
    this.setupMonitoring();

    console.log('KB Assistant Backend initialized successfully');
  }

  private setupServices(): void {
    // Register core services
    this.serviceManager.registerService(new EnhancedKnowledgeService(
      new CachedKnowledgeBaseRepository(
        new OptimizedKnowledgeBaseRepository(),
        new MultiLayerCache()
      ),
      new MultiLayerCache(),
      new ValidationService()
    ));

    this.serviceManager.registerService(new SearchService());
    this.serviceManager.registerService(new MetricsService());
    this.serviceManager.registerService(new CacheService());
  }

  private setupHandlers(): void {
    const knowledgeService = this.serviceManager.getService<IKnowledgeService>('knowledge');
    const validator = this.serviceManager.getService<IValidationService>('validation');
    const metrics = this.serviceManager.getService<IMetricsService>('metrics');
    const logger = this.serviceManager.getService<ILogger>('logger');

    // Register handlers
    this.handlerRegistry.register('kb', new KnowledgeBaseHandler(
      knowledgeService!, validator!, metrics!, logger!
    ));

    this.handlerRegistry.register('search', new SearchHandler(
      this.serviceManager.getService<ISearchService>('search')!,
      validator!, metrics!, logger!
    ));

    this.handlerRegistry.register('metrics', new MetricsHandler(
      metrics!, logger!
    ));
  }

  private setupMiddleware(): void {
    const metrics = this.serviceManager.getService<IMetricsService>('metrics')!;
    const rateLimiter = new RateLimiter({ maxRequests: 100, windowMs: 60000 });
    const validator = this.serviceManager.getService<IValidationService>('validation')!;

    // Add middleware in order
    this.handlerRegistry.use(new SecurityMiddleware(rateLimiter, new InputSanitizer()));
    this.handlerRegistry.use(new ValidationMiddleware(validator));
    this.handlerRegistry.use(new PerformanceMiddleware(metrics));
  }

  async handleIPCRequest(channel: string, request: any): Promise<any> {
    return this.handlerRegistry.handle(channel, request);
  }

  async shutdown(): Promise<void> {
    await this.pluginManager.shutdown();
    await this.serviceManager.shutdown();
  }
}
```

### 10.2 Usage Example

```typescript
// Example usage in main process
async function initializeBackend() {
  const config: BackendConfig = {
    serviceManager: {
      gracefulShutdownTimeout: 30000,
      healthCheckInterval: 60000,
      enableMetrics: true,
      enableHealthChecks: true
    },
    database: {
      path: './knowledge.db',
      pragmas: {
        journal_mode: 'WAL',
        synchronous: 'NORMAL',
        cache_size: -64000
      }
    },
    cache: {
      maxSize: 10000,
      ttl: 3600000,
      enablePersistentCache: true
    },
    monitoring: {
      slowQueryThreshold: 1000,
      alerts: {
        errorRateThreshold: 0.05,
        latencyThreshold: 2000
      }
    }
  };

  const backend = new KBAssistantBackend(config);
  await backend.initialize();

  // Setup IPC handlers
  ipcMain.handle('kb.search', async (event, request) => {
    return backend.handleIPCRequest('kb.search', request);
  });

  ipcMain.handle('kb.create', async (event, request) => {
    return backend.handleIPCRequest('kb.create', request);
  });

  // Graceful shutdown
  app.on('before-quit', async () => {
    await backend.shutdown();
  });

  return backend;
}
```

## 11. Performance Benchmarks and Targets

### 11.1 Performance Requirements (MVP1)

| Operation | Target | Acceptable | Critical |
|-----------|--------|------------|----------|
| KB Search | <500ms | <1s | <2s |
| Entry Creation | <200ms | <500ms | <1s |
| Entry Retrieval | <100ms | <200ms | <500ms |
| Bulk Operations | <2s/100 items | <5s/100 items | <10s/100 items |
| Cache Hit | <10ms | <50ms | <100ms |
| Database Query | <100ms | <300ms | <1s |

### 11.2 Scalability Targets

| Metric | MVP1 | MVP2 | MVP3+ |
|--------|------|------|-------|
| Concurrent Users | 5-10 | 20-50 | 100+ |
| KB Entries | 100-1000 | 1000-5000 | 10000+ |
| Search Queries/sec | 10 | 50 | 200+ |
| Cache Size | 100MB | 500MB | 2GB+ |
| Database Size | 50MB | 200MB | 1GB+ |

## Conclusion

This backend architecture provides a robust, scalable, and maintainable foundation for the Mainframe KB Assistant. Key benefits include:

1. **Modularity**: Clean separation of concerns with well-defined interfaces
2. **Performance**: Multi-layer caching, query optimization, and connection pooling
3. **Resilience**: Circuit breakers, retry policies, and graceful degradation
4. **Extensibility**: Plugin system for MVP evolution
5. **Observability**: Comprehensive monitoring and metrics
6. **Testability**: Mockable interfaces and dependency injection

The architecture supports the Knowledge-First approach while providing the technical foundation needed for future MVP enhancements and enterprise-scale deployment.