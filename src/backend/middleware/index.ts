/**
 * Middleware System for Backend Component Architecture
 * Comprehensive middleware implementations for request processing
 */

export interface IPCRequest<T = any> {
  channel: string;
  data: T;
  metadata?: {
    requestId?: string;
    clientId?: string;
    timestamp?: Date;
    startTime?: number;
    sessionId?: string;
    userId?: string;
    [key: string]: any;
  };
}

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
    operationId?: string;
  };
  metadata?: {
    operationId: string;
    duration: number;
    timestamp: Date;
    [key: string]: any;
  };
}

export interface IPCMiddleware {
  process(request: IPCRequest): Promise<IPCRequest>;
}

// ==============================
// Core Middleware Implementations
// ==============================

/**
 * Performance Monitoring Middleware
 * Tracks request timing and performance metrics
 */
export class PerformanceMiddleware implements IPCMiddleware {
  private readonly metrics: Map<string, PerformanceStats> = new Map();
  private readonly slowQueryThreshold: number;

  constructor(private readonly metricsService: any, slowQueryThreshold = 1000) {
    this.slowQueryThreshold = slowQueryThreshold;
  }

  async process(request: IPCRequest): Promise<IPCRequest> {
    const startTime = Date.now();
    const operationId = this.generateOperationId();

    // Add timing metadata to request
    request.metadata = {
      ...request.metadata,
      operationId,
      startTime,
      performanceTracing: true
    };

    // Set up completion handler
    const originalOnComplete = request.metadata.onComplete;
    request.metadata.onComplete = (response: IPCResponse) => {
      const duration = Date.now() - startTime;

      // Record metrics
      this.recordMetrics(request.channel, duration, response.success);

      // Check for slow operations
      if (duration > this.slowQueryThreshold) {
        this.recordSlowOperation(request.channel, duration, {
          operationId,
          requestData: this.sanitizeRequestData(request.data)
        });
      }

      // Call original completion handler if exists
      if (originalOnComplete) {
        originalOnComplete(response);
      }
    };

    return request;
  }

  private recordMetrics(channel: string, duration: number, success: boolean): void {
    const stats = this.metrics.get(channel) || this.createEmptyStats();

    stats.totalRequests++;
    stats.totalDuration += duration;
    stats.averageDuration = stats.totalDuration / stats.totalRequests;

    if (success) {
      stats.successCount++;
    } else {
      stats.errorCount++;
    }

    stats.minDuration = Math.min(stats.minDuration, duration);
    stats.maxDuration = Math.max(stats.maxDuration, duration);

    this.metrics.set(channel, stats);

    // Send to metrics service if available
    if (this.metricsService) {
      this.metricsService.recordOperation(channel, success, duration);
    }
  }

  private recordSlowOperation(channel: string, duration: number, metadata: any): void {
    console.warn(`Slow operation detected: ${channel} took ${duration}ms`, metadata);

    if (this.metricsService) {
      this.metricsService.recordSlowQuery(channel, duration, metadata);
    }
  }

  private createEmptyStats(): PerformanceStats {
    return {
      totalRequests: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      successCount: 0,
      errorCount: 0
    };
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeRequestData(data: any): any {
    // Remove sensitive information before logging
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  getStats(): Map<string, PerformanceStats> {
    return new Map(this.metrics);
  }

  resetStats(): void {
    this.metrics.clear();
  }
}

/**
 * Security Middleware
 * Handles rate limiting, input sanitization, and basic security checks
 */
export class SecurityMiddleware implements IPCMiddleware {
  private readonly rateLimiter: RateLimiter;
  private readonly inputSanitizer: InputSanitizer;
  private readonly securityConfig: SecurityConfig;

  constructor(
    rateLimiter: RateLimiter,
    inputSanitizer: InputSanitizer,
    securityConfig: SecurityConfig = DEFAULT_SECURITY_CONFIG
  ) {
    this.rateLimiter = rateLimiter;
    this.inputSanitizer = inputSanitizer;
    this.securityConfig = securityConfig;
  }

  async process(request: IPCRequest): Promise<IPCRequest> {
    const clientId = this.extractClientId(request);

    // Rate limiting check
    await this.checkRateLimit(request.channel, clientId);

    // Input sanitization
    if (request.data) {
      request.data = this.inputSanitizer.sanitize(request.data);
    }

    // Security validation
    await this.validateSecurity(request);

    // Add security metadata
    request.metadata = {
      ...request.metadata,
      securityValidated: true,
      sanitized: true,
      clientId
    };

    return request;
  }

  private extractClientId(request: IPCRequest): string {
    return request.metadata?.clientId ||
           request.metadata?.userId ||
           'anonymous';
  }

  private async checkRateLimit(channel: string, clientId: string): Promise<void> {
    const allowed = await this.rateLimiter.checkLimit(channel, clientId);

    if (!allowed) {
      throw new RateLimitError(`Rate limit exceeded for channel: ${channel}`, {
        channel,
        clientId,
        limit: this.rateLimiter.getLimit(channel)
      });
    }
  }

  private async validateSecurity(request: IPCRequest): Promise<void> {
    // Check for suspicious patterns
    if (this.containsSuspiciousContent(request)) {
      throw new SecurityError('Suspicious content detected', {
        channel: request.channel,
        operationId: request.metadata?.operationId
      });
    }

    // Validate request size
    const requestSize = JSON.stringify(request.data).length;
    if (requestSize > this.securityConfig.maxRequestSize) {
      throw new SecurityError('Request size exceeds limit', {
        size: requestSize,
        limit: this.securityConfig.maxRequestSize
      });
    }
  }

  private containsSuspiciousContent(request: IPCRequest): boolean {
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi
    ];

    const content = JSON.stringify(request.data);
    return suspiciousPatterns.some(pattern => pattern.test(content));
  }
}

/**
 * Validation Middleware
 * Validates request data against schemas
 */
export class ValidationMiddleware implements IPCMiddleware {
  private readonly schemas: Map<string, ValidationSchema> = new Map();
  private readonly validator: IValidator;

  constructor(validator: IValidator) {
    this.validator = validator;
  }

  registerSchema(channel: string, schema: ValidationSchema): void {
    this.schemas.set(channel, schema);
  }

  async process(request: IPCRequest): Promise<IPCRequest> {
    const schema = this.schemas.get(request.channel);

    if (schema) {
      const result = await this.validator.validate(request.data, schema);

      if (!result.isValid) {
        throw new ValidationError('Request validation failed', {
          errors: result.errors,
          channel: request.channel,
          operationId: request.metadata?.operationId
        });
      }

      // Use validated/transformed data
      request.data = result.data || request.data;
    }

    request.metadata = {
      ...request.metadata,
      validated: true,
      schemaUsed: schema ? true : false
    };

    return request;
  }

  getRegisteredSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }
}

/**
 * Logging Middleware
 * Comprehensive request/response logging
 */
export class LoggingMiddleware implements IPCMiddleware {
  private readonly logger: ILogger;
  private readonly config: LoggingConfig;

  constructor(logger: ILogger, config: LoggingConfig = DEFAULT_LOGGING_CONFIG) {
    this.logger = logger;
    this.config = config;
  }

  async process(request: IPCRequest): Promise<IPCRequest> {
    const operationId = request.metadata?.operationId || this.generateOperationId();
    const startTime = Date.now();

    // Log incoming request
    if (this.config.logRequests) {
      this.logger.info('Incoming request', {
        operationId,
        channel: request.channel,
        timestamp: new Date(),
        clientId: request.metadata?.clientId,
        requestSize: this.calculateRequestSize(request.data)
      });

      if (this.config.logRequestData) {
        this.logger.debug('Request data', {
          operationId,
          data: this.sanitizeData(request.data)
        });
      }
    }

    // Set up response logging
    const originalOnComplete = request.metadata?.onComplete;
    request.metadata = {
      ...request.metadata,
      operationId,
      onComplete: (response: IPCResponse) => {
        this.logResponse(operationId, request.channel, response, Date.now() - startTime);

        if (originalOnComplete) {
          originalOnComplete(response);
        }
      }
    };

    return request;
  }

  private logResponse(operationId: string, channel: string, response: IPCResponse, duration: number): void {
    const logData = {
      operationId,
      channel,
      success: response.success,
      duration,
      timestamp: new Date()
    };

    if (response.success) {
      if (this.config.logResponses) {
        this.logger.info('Request completed successfully', logData);
      }
    } else {
      this.logger.error('Request failed', response.error, {
        ...logData,
        errorCode: response.error?.code,
        errorMessage: response.error?.message
      });
    }

    if (this.config.logResponseData && response.data) {
      this.logger.debug('Response data', {
        operationId,
        dataSize: this.calculateResponseSize(response.data)
      });
    }
  }

  private calculateRequestSize(data: any): number {
    return data ? JSON.stringify(data).length : 0;
  }

  private calculateResponseSize(data: any): number {
    return data ? JSON.stringify(data).length : 0;
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private generateOperationId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Caching Middleware
 * Handles request/response caching
 */
export class CachingMiddleware implements IPCMiddleware {
  private readonly cache: ICacheService;
  private readonly config: CachingConfig;
  private readonly cacheableChannels: Set<string>;

  constructor(cache: ICacheService, config: CachingConfig = DEFAULT_CACHING_CONFIG) {
    this.cache = cache;
    this.config = config;
    this.cacheableChannels = new Set(config.cacheableChannels || []);
  }

  async process(request: IPCRequest): Promise<IPCRequest> {
    if (!this.isCacheable(request.channel)) {
      return request;
    }

    const cacheKey = this.generateCacheKey(request);

    // Try to get cached response
    const cachedResponse = await this.cache.get<IPCResponse>(cacheKey);

    if (cachedResponse && !this.isCacheExpired(cachedResponse)) {
      // Return cached response immediately
      request.metadata = {
        ...request.metadata,
        cacheHit: true,
        skipProcessing: true,
        cachedResponse
      };

      return request;
    }

    // Set up caching for response
    const originalOnComplete = request.metadata?.onComplete;
    request.metadata = {
      ...request.metadata,
      cacheHit: false,
      onComplete: async (response: IPCResponse) => {
        // Cache successful responses
        if (response.success && this.shouldCache(request, response)) {
          await this.cacheResponse(cacheKey, response);
        }

        if (originalOnComplete) {
          originalOnComplete(response);
        }
      }
    };

    return request;
  }

  private isCacheable(channel: string): boolean {
    return this.cacheableChannels.has(channel) || this.config.cacheAll;
  }

  private generateCacheKey(request: IPCRequest): string {
    const keyData = {
      channel: request.channel,
      data: request.data,
      userId: request.metadata?.userId
    };

    return `middleware_cache:${this.hashObject(keyData)}`;
  }

  private hashObject(obj: any): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex');
  }

  private isCacheExpired(cachedResponse: IPCResponse): boolean {
    if (!cachedResponse.metadata?.timestamp) return true;

    const age = Date.now() - cachedResponse.metadata.timestamp.getTime();
    return age > this.config.defaultTtl;
  }

  private shouldCache(request: IPCRequest, response: IPCResponse): boolean {
    // Don't cache large responses
    const responseSize = JSON.stringify(response.data).length;
    if (responseSize > this.config.maxCacheSize) {
      return false;
    }

    // Don't cache error responses (unless configured to)
    if (!response.success && !this.config.cacheErrors) {
      return false;
    }

    return true;
  }

  private async cacheResponse(key: string, response: IPCResponse): Promise<void> {
    try {
      const ttl = this.config.channelTtls?.[response.metadata?.channel as string] ||
                  this.config.defaultTtl;

      await this.cache.set(key, response, ttl);
    } catch (error) {
      // Cache failures shouldn't break the request
      console.warn('Failed to cache response:', error);
    }
  }

  addCacheableChannel(channel: string): void {
    this.cacheableChannels.add(channel);
  }

  removeCacheableChannel(channel: string): void {
    this.cacheableChannels.delete(channel);
  }
}

// ==============================
// Supporting Classes
// ==============================

export class RateLimiter {
  private readonly limits: Map<string, ChannelLimit> = new Map();
  private readonly requests: Map<string, RequestRecord[]> = new Map();

  constructor(private readonly config: RateLimitConfig) {}

  async checkLimit(channel: string, clientId: string): Promise<boolean> {
    const key = `${channel}:${clientId}`;
    const limit = this.getChannelLimit(channel);

    const now = Date.now();
    const windowStart = now - limit.windowMs;

    // Get existing requests for this key
    const existingRequests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = existingRequests.filter(req => req.timestamp > windowStart);

    // Check if limit would be exceeded
    if (validRequests.length >= limit.maxRequests) {
      return false;
    }

    // Add current request
    validRequests.push({ timestamp: now });
    this.requests.set(key, validRequests);

    return true;
  }

  getLimit(channel: string): ChannelLimit {
    return this.getChannelLimit(channel);
  }

  private getChannelLimit(channel: string): ChannelLimit {
    return this.limits.get(channel) || {
      maxRequests: this.config.defaultMaxRequests,
      windowMs: this.config.defaultWindowMs
    };
  }

  setChannelLimit(channel: string, limit: ChannelLimit): void {
    this.limits.set(channel, limit);
  }

  clearRequests(channel?: string, clientId?: string): void {
    if (channel && clientId) {
      this.requests.delete(`${channel}:${clientId}`);
    } else if (channel) {
      const keysToDelete = Array.from(this.requests.keys())
        .filter(key => key.startsWith(`${channel}:`));
      keysToDelete.forEach(key => this.requests.delete(key));
    } else {
      this.requests.clear();
    }
  }
}

export class InputSanitizer {
  private readonly config: SanitizationConfig;

  constructor(config: SanitizationConfig = DEFAULT_SANITIZATION_CONFIG) {
    this.config = config;
  }

  sanitize(input: any): any {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === 'string') {
      return this.sanitizeString(input);
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitize(item));
    }

    if (typeof input === 'object') {
      return this.sanitizeObject(input);
    }

    return input;
  }

  private sanitizeString(str: string): string {
    let sanitized = str;

    // Remove/escape HTML tags if configured
    if (this.config.removeHtmlTags) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Remove script tags always
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // Escape special characters
    if (this.config.escapeHtml) {
      sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }

    // Trim whitespace
    if (this.config.trimWhitespace) {
      sanitized = sanitized.trim();
    }

    return sanitized;
  }

  private sanitizeObject(obj: any): any {
    const sanitized: any = {};

    Object.keys(obj).forEach(key => {
      // Sanitize the key itself
      const sanitizedKey = this.config.sanitizeKeys ? this.sanitizeString(key) : key;

      // Sanitize the value
      sanitized[sanitizedKey] = this.sanitize(obj[key]);
    });

    return sanitized;
  }
}

// ==============================
// Configuration Interfaces
// ==============================

interface PerformanceStats {
  totalRequests: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successCount: number;
  errorCount: number;
}

interface SecurityConfig {
  maxRequestSize: number;
  enableContentFiltering: boolean;
  suspiciousPatterns: string[];
}

interface ValidationSchema {
  type: string;
  properties: Record<string, any>;
  required?: string[];
}

interface LoggingConfig {
  logRequests: boolean;
  logResponses: boolean;
  logRequestData: boolean;
  logResponseData: boolean;
  logErrors: boolean;
}

interface CachingConfig {
  cacheAll: boolean;
  cacheableChannels: string[];
  defaultTtl: number;
  channelTtls?: Record<string, number>;
  maxCacheSize: number;
  cacheErrors: boolean;
}

interface RateLimitConfig {
  defaultMaxRequests: number;
  defaultWindowMs: number;
}

interface ChannelLimit {
  maxRequests: number;
  windowMs: number;
}

interface RequestRecord {
  timestamp: number;
}

interface SanitizationConfig {
  removeHtmlTags: boolean;
  escapeHtml: boolean;
  trimWhitespace: boolean;
  sanitizeKeys: boolean;
}

// ==============================
// Error Classes
// ==============================

class RateLimitError extends Error {
  constructor(message: string, public metadata: any = {}) {
    super(message);
    this.name = 'RateLimitError';
  }
}

class SecurityError extends Error {
  constructor(message: string, public metadata: any = {}) {
    super(message);
    this.name = 'SecurityError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public metadata: any = {}) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ==============================
// Default Configurations
// ==============================

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  enableContentFiltering: true,
  suspiciousPatterns: []
};

const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  logRequests: true,
  logResponses: false,
  logRequestData: false,
  logResponseData: false,
  logErrors: true
};

const DEFAULT_CACHING_CONFIG: CachingConfig = {
  cacheAll: false,
  cacheableChannels: ['kb.search', 'kb.categories', 'kb.tags'],
  defaultTtl: 300000, // 5 minutes
  maxCacheSize: 1024 * 1024, // 1MB
  cacheErrors: false
};

const DEFAULT_SANITIZATION_CONFIG: SanitizationConfig = {
  removeHtmlTags: false,
  escapeHtml: true,
  trimWhitespace: true,
  sanitizeKeys: false
};

// ==============================
// Utility Functions
// ==============================

export function createMiddlewareChain(middlewares: IPCMiddleware[]) {
  return async function processRequest(request: IPCRequest): Promise<IPCRequest> {
    let processedRequest = request;

    for (const middleware of middlewares) {
      processedRequest = await middleware.process(processedRequest);

      // If middleware sets skipProcessing, stop the chain
      if (processedRequest.metadata?.skipProcessing) {
        break;
      }
    }

    return processedRequest;
  };
}

// Placeholder interfaces for missing dependencies
interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
}

interface IValidator {
  validate(data: any, schema: ValidationSchema): Promise<{ isValid: boolean; data?: any; errors: any[] }>;
}

interface ILogger {
  info(message: string, metadata?: any): void;
  debug(message: string, metadata?: any): void;
  error(message: string, error?: Error, metadata?: any): void;
}