/**
 * IPC Error Handler
 * 
 * Comprehensive error handling system for IPC operations with
 * classification, recovery strategies, and detailed logging.
 */

import { AppError } from '../../../core/errors/AppError';
import { 
  IPCError, 
  IPCErrorCode, 
  BaseIPCRequest, 
  BaseIPCResponse 
} from '../../../types/ipc';

// ===========================
// Error Context and Metrics
// ===========================

interface ErrorContext {
  channel: string;
  requestId: string;
  userId?: string;
  sessionId?: string;
  timestamp: number;
  executionTimeMs?: number;
  retryCount?: number;
  originalError?: any;
  requestPayload?: any;
  systemInfo?: {
    memoryUsage: number;
    cpuUsage?: number;
    activeConnections?: number;
  };
}

interface ErrorMetrics {
  totalErrors: number;
  errorsByCode: Map<IPCErrorCode, number>;
  errorsByChannel: Map<string, number>;
  errorRate: number;
  meanTimeToRecover: number;
  criticalErrors: number;
  recentErrors: ErrorEvent[];
}

interface ErrorEvent {
  timestamp: number;
  code: IPCErrorCode;
  channel: string;
  severity: ErrorSeverity;
  message: string;
  resolved: boolean;
  resolutionTimeMs?: number;
}

type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

// ===========================
// Recovery Strategies
// ===========================

interface RecoveryStrategy {
  retryable: boolean;
  maxRetries: number;
  retryDelayMs: number[];
  backoffMultiplier: number;
  circuitBreakerEnabled: boolean;
  fallbackHandler?: (context: ErrorContext) => Promise<any>;
  shouldRetry?: (error: IPCError, attempt: number) => boolean;
}

interface FallbackResult {
  success: boolean;
  data?: any;
  fallbackUsed: string;
  degraded?: boolean;
}

// ===========================
// Circuit Breaker
// ===========================

class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeoutMs: number = 60000,
    private successThreshold: number = 3
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeoutMs) {
        this.state = 'half-open';
        this.failures = 0;
      } else {
        throw new AppError('CIRCUIT_BREAKER_OPEN', 'Circuit breaker is open');
      }
    }

    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.failures = 0;
        if (this.failures === 0) {
          this.state = 'closed';
        }
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.failureThreshold) {
        this.state = 'open';
      }
      
      throw error;
    }
  }

  getState(): { state: string; failures: number; lastFailure: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: this.lastFailureTime
    };
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.lastFailureTime = 0;
  }
}

// ===========================
// Main Error Handler
// ===========================

export class IPCErrorHandler {
  private readonly metrics: ErrorMetrics;
  private readonly recoveryStrategies = new Map<string, RecoveryStrategy>();
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly errorEvents: ErrorEvent[] = [];
  
  constructor() {
    this.metrics = {
      totalErrors: 0,
      errorsByCode: new Map(),
      errorsByChannel: new Map(),
      errorRate: 0,
      meanTimeToRecover: 0,
      criticalErrors: 0,
      recentErrors: []
    };
    
    this.initializeRecoveryStrategies();
    this.startMetricsCollection();
  }

  /**
   * Main error handling entry point
   */
  async handleError(
    error: unknown, 
    context: ErrorContext
  ): Promise<BaseIPCResponse> {
    const startTime = Date.now();
    
    try {
      // Transform error to standardized format
      const ipcError = this.transformError(error, context);
      
      // Record error metrics
      this.recordError(ipcError, context);
      
      // Log error with appropriate level
      this.logError(ipcError, context);
      
      // Attempt recovery if strategy exists
      const recoveryResult = await this.attemptRecovery(ipcError, context);
      
      if (recoveryResult.success) {
        // Recovery succeeded
        this.recordRecovery(context, Date.now() - startTime);
        
        return {
          success: true,
          requestId: context.requestId,
          timestamp: Date.now(),
          executionTime: Date.now() - context.timestamp,
          data: recoveryResult.data,
          metadata: {
            cached: false,
            batched: false,
            streamed: false,
            recoveryUsed: recoveryResult.fallbackUsed,
            degraded: recoveryResult.degraded
          }
        };
      }

      // Recovery failed or not available, return error response
      return {
        success: false,
        requestId: context.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - context.timestamp,
        error: this.sanitizeErrorForClient(ipcError),
        metadata: {
          cached: false,
          batched: false,
          streamed: false,
          errorCode: ipcError.code,
          retryable: this.isRetryable(ipcError),
          severity: this.getErrorSeverity(ipcError.code)
        }
      };
      
    } catch (handlerError) {
      // Error in error handler itself - this is critical
      console.error('Critical: Error in IPC error handler:', handlerError);
      
      return {
        success: false,
        requestId: context.requestId,
        timestamp: Date.now(),
        executionTime: Date.now() - context.timestamp,
        error: {
          code: IPCErrorCode.HANDLER_ERROR,
          message: 'Internal error handling failed',
          severity: 'critical',
          retryable: false
        }
      };
    }
  }

  /**
   * Transform various error types to standardized IPCError
   */
  private transformError(error: unknown, context: ErrorContext): IPCError {
    // Handle AppError instances
    if (error instanceof AppError) {
      return {
        code: error.code as IPCErrorCode,
        message: error.message,
        severity: this.getErrorSeverity(error.code as IPCErrorCode),
        retryable: this.isRetryableByCode(error.code as IPCErrorCode),
        details: {
          ...error.details,
          context: this.sanitizeContext(context)
        }
      };
    }
    
    // Handle validation errors (Zod)
    if (error && typeof error === 'object' && 'issues' in error) {
      return {
        code: IPCErrorCode.VALIDATION_FAILED,
        message: 'Input validation failed',
        severity: 'warning',
        retryable: false,
        details: {
          issues: (error as any).issues,
          context: this.sanitizeContext(context)
        }
      };
    }
    
    // Handle database errors
    if (this.isDatabaseError(error)) {
      return {
        code: IPCErrorCode.DATABASE_ERROR,
        message: 'Database operation failed',
        severity: 'error',
        retryable: true,
        details: {
          dbError: this.sanitizeDatabaseError(error),
          context: this.sanitizeContext(context)
        }
      };
    }
    
    // Handle timeout errors
    if (this.isTimeoutError(error)) {
      return {
        code: IPCErrorCode.TIMEOUT,
        message: `Operation timed out after ${context.executionTimeMs}ms`,
        severity: 'warning',
        retryable: true,
        details: {
          timeoutMs: context.executionTimeMs,
          context: this.sanitizeContext(context)
        }
      };
    }
    
    // Handle network errors
    if (this.isNetworkError(error)) {
      return {
        code: IPCErrorCode.NETWORK_ERROR,
        message: 'Network operation failed',
        severity: 'error',
        retryable: true,
        details: {
          networkError: String(error),
          context: this.sanitizeContext(context)
        }
      };
    }
    
    // Handle memory errors
    if (this.isMemoryError(error)) {
      return {
        code: IPCErrorCode.MEMORY_ERROR,
        message: 'Insufficient memory for operation',
        severity: 'critical',
        retryable: false,
        details: {
          memoryUsage: context.systemInfo?.memoryUsage,
          context: this.sanitizeContext(context)
        }
      };
    }
    
    // Generic error handling
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      code: IPCErrorCode.HANDLER_ERROR,
      message: errorMessage || 'An unexpected error occurred',
      severity: 'error',
      retryable: this.isRetryableByMessage(errorMessage),
      details: {
        originalError: this.sanitizeError(error),
        context: this.sanitizeContext(context)
      }
    };
  }

  /**
   * Attempt to recover from error using configured strategies
   */
  private async attemptRecovery(
    error: IPCError, 
    context: ErrorContext
  ): Promise<FallbackResult> {
    const strategy = this.recoveryStrategies.get(context.channel);
    
    if (!strategy || !error.retryable) {
      return { success: false, fallbackUsed: 'none' };
    }

    // Try retries with exponential backoff
    if (strategy.retryable && context.retryCount !== undefined && context.retryCount < strategy.maxRetries) {
      if (strategy.shouldRetry && !strategy.shouldRetry(error, context.retryCount)) {
        return { success: false, fallbackUsed: 'retry-skipped' };
      }

      const delayMs = strategy.retryDelayMs[context.retryCount] || 
                     strategy.retryDelayMs[strategy.retryDelayMs.length - 1] * 
                     Math.pow(strategy.backoffMultiplier, context.retryCount);

      await this.delay(delayMs);
      
      // This would trigger a retry in the calling code
      return { success: false, fallbackUsed: 'retry-scheduled' };
    }

    // Try circuit breaker if enabled
    if (strategy.circuitBreakerEnabled) {
      const circuitBreaker = this.getCircuitBreaker(context.channel);
      const breakerState = circuitBreaker.getState();
      
      if (breakerState.state === 'open') {
        return { success: false, fallbackUsed: 'circuit-breaker-open' };
      }
    }

    // Try fallback handler
    if (strategy.fallbackHandler) {
      try {
        const fallbackData = await strategy.fallbackHandler(context);
        return { 
          success: true, 
          data: fallbackData, 
          fallbackUsed: 'handler',
          degraded: true 
        };
      } catch (fallbackError) {
        console.warn('Fallback handler failed:', fallbackError);
      }
    }

    // Try built-in fallback strategies
    return await this.tryBuiltinFallbacks(error, context);
  }

  /**
   * Try built-in fallback strategies
   */
  private async tryBuiltinFallbacks(
    error: IPCError, 
    context: ErrorContext
  ): Promise<FallbackResult> {
    switch (context.channel) {
      case 'kb:search:ai':
        // Fallback from AI search to local search
        return { 
          success: true, 
          data: await this.fallbackToLocalSearch(context), 
          fallbackUsed: 'local-search',
          degraded: true 
        };
      
      case 'kb:entry:get':
        // Try to get from cache if database fails
        return await this.fallbackToCachedEntry(context);
      
      case 'system:metrics:get':
        // Return basic metrics if detailed metrics fail
        return { 
          success: true, 
          data: await this.getBasicMetrics(), 
          fallbackUsed: 'basic-metrics',
          degraded: true 
        };
      
      default:
        return { success: false, fallbackUsed: 'none' };
    }
  }

  /**
   * Initialize recovery strategies for different channels
   */
  private initializeRecoveryStrategies(): void {
    // AI Search with fallback to local search
    this.recoveryStrategies.set('kb:search:ai', {
      retryable: true,
      maxRetries: 2,
      retryDelayMs: [1000, 2000],
      backoffMultiplier: 2,
      circuitBreakerEnabled: true,
      shouldRetry: (error, attempt) => {
        return error.code === IPCErrorCode.EXTERNAL_SERVICE_ERROR && attempt < 2;
      }
    });

    // Database operations
    this.recoveryStrategies.set('kb:entry:get', {
      retryable: true,
      maxRetries: 3,
      retryDelayMs: [500, 1000, 2000],
      backoffMultiplier: 1.5,
      circuitBreakerEnabled: true
    });

    this.recoveryStrategies.set('kb:entry:create', {
      retryable: true,
      maxRetries: 2,
      retryDelayMs: [1000, 3000],
      backoffMultiplier: 2,
      circuitBreakerEnabled: false // Don't use circuit breaker for writes
    });

    // System operations
    this.recoveryStrategies.set('system:metrics:get', {
      retryable: true,
      maxRetries: 1,
      retryDelayMs: [2000],
      backoffMultiplier: 1,
      circuitBreakerEnabled: false
    });

    // Non-retryable operations
    this.recoveryStrategies.set('kb:entry:delete', {
      retryable: false,
      maxRetries: 0,
      retryDelayMs: [],
      backoffMultiplier: 1,
      circuitBreakerEnabled: false
    });
  }

  /**
   * Record error in metrics
   */
  private recordError(error: IPCError, context: ErrorContext): void {
    this.metrics.totalErrors++;
    
    // Count by error code
    const codeCount = this.metrics.errorsByCode.get(error.code) || 0;
    this.metrics.errorsByCode.set(error.code, codeCount + 1);
    
    // Count by channel
    const channelCount = this.metrics.errorsByChannel.get(context.channel) || 0;
    this.metrics.errorsByChannel.set(context.channel, channelCount + 1);
    
    // Count critical errors
    if (error.severity === 'critical') {
      this.metrics.criticalErrors++;
    }
    
    // Add to recent errors
    const errorEvent: ErrorEvent = {
      timestamp: Date.now(),
      code: error.code,
      channel: context.channel,
      severity: error.severity,
      message: error.message,
      resolved: false
    };
    
    this.errorEvents.push(errorEvent);
    this.metrics.recentErrors = this.errorEvents
      .filter(e => Date.now() - e.timestamp < 24 * 60 * 60 * 1000)
      .slice(-100);
  }

  /**
   * Record successful recovery
   */
  private recordRecovery(context: ErrorContext, recoveryTimeMs: number): void {
    const recentError = this.errorEvents
      .reverse()
      .find(e => e.channel === context.channel && !e.resolved);
    
    if (recentError) {
      recentError.resolved = true;
      recentError.resolutionTimeMs = recoveryTimeMs;
    }
    
    // Update mean time to recover
    const recoveredErrors = this.errorEvents.filter(e => e.resolved && e.resolutionTimeMs);
    if (recoveredErrors.length > 0) {
      const totalRecoveryTime = recoveredErrors.reduce((sum, e) => sum + (e.resolutionTimeMs || 0), 0);
      this.metrics.meanTimeToRecover = totalRecoveryTime / recoveredErrors.length;
    }
  }

  /**
   * Log error with appropriate severity
   */
  private logError(error: IPCError, context: ErrorContext): void {
    const logData = {
      channel: context.channel,
      code: error.code,
      message: error.message,
      requestId: context.requestId,
      userId: context.userId,
      executionTime: context.executionTimeMs,
      retryCount: context.retryCount,
      timestamp: new Date().toISOString()
    };

    switch (error.severity) {
      case 'critical':
        console.error('🚨 CRITICAL IPC Error:', logData, error.details);
        break;
      case 'error':
        console.error('❌ IPC Error:', logData);
        break;
      case 'warning':
        console.warn('⚠️  IPC Warning:', logData);
        break;
      case 'info':
        console.info('ℹ️  IPC Info:', logData);
        break;
    }
    
    // Additional logging for high-frequency errors
    const channelErrorCount = this.metrics.errorsByChannel.get(context.channel) || 0;
    if (channelErrorCount > 10) {
      console.warn(`⚠️  High error frequency in channel ${context.channel}: ${channelErrorCount} errors`);
    }
  }

  /**
   * Determine error severity from error code
   */
  private getErrorSeverity(code: IPCErrorCode): ErrorSeverity {
    const severityMap: Record<IPCErrorCode, ErrorSeverity> = {
      [IPCErrorCode.MEMORY_ERROR]: 'critical',
      [IPCErrorCode.UNHANDLED_REJECTION]: 'critical',
      [IPCErrorCode.DATABASE_ERROR]: 'error',
      [IPCErrorCode.HANDLER_ERROR]: 'error',
      [IPCErrorCode.EXTERNAL_SERVICE_ERROR]: 'error',
      [IPCErrorCode.CACHE_ERROR]: 'error',
      [IPCErrorCode.NETWORK_ERROR]: 'error',
      [IPCErrorCode.TIMEOUT]: 'warning',
      [IPCErrorCode.RATE_LIMIT_EXCEEDED]: 'warning',
      [IPCErrorCode.VALIDATION_FAILED]: 'warning',
      [IPCErrorCode.INVALID_CHANNEL]: 'warning',
      [IPCErrorCode.MALICIOUS_INPUT]: 'warning',
      [IPCErrorCode.ENTRY_NOT_FOUND]: 'info',
      [IPCErrorCode.DUPLICATE_ENTRY]: 'info',
      [IPCErrorCode.INVALID_SEARCH_QUERY]: 'info'
    } as any;

    return severityMap[code] || 'error';
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: IPCError): boolean {
    return error.retryable ?? this.isRetryableByCode(error.code);
  }

  private isRetryableByCode(code: IPCErrorCode): boolean {
    const retryableCodes = new Set([
      IPCErrorCode.DATABASE_ERROR,
      IPCErrorCode.CACHE_ERROR,
      IPCErrorCode.EXTERNAL_SERVICE_ERROR,
      IPCErrorCode.NETWORK_ERROR,
      IPCErrorCode.TIMEOUT
    ]);

    return retryableCodes.has(code);
  }

  private isRetryableByMessage(message: string): boolean {
    const retryablePatterns = [
      /connection/i,
      /timeout/i,
      /network/i,
      /temporary/i,
      /unavailable/i
    ];

    return retryablePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Error type detection methods
   */
  private isDatabaseError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const err = error as any;
      return err.code === 'SQLITE_ERROR' || 
             err.code === 'SQLITE_BUSY' ||
             err.errno !== undefined ||
             /database|sqlite/i.test(err.message || '');
    }
    return false;
  }

  private isTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
      return /timeout|timed out/i.test(error.message);
    }
    return false;
  }

  private isNetworkError(error: unknown): boolean {
    if (error && typeof error === 'object') {
      const err = error as any;
      return err.code === 'ENOTFOUND' ||
             err.code === 'ECONNREFUSED' ||
             err.code === 'ETIMEDOUT' ||
             /network|connection|dns/i.test(err.message || '');
    }
    return false;
  }

  private isMemoryError(error: unknown): boolean {
    if (error instanceof Error) {
      return /memory|allocation|out of memory/i.test(error.message);
    }
    return false;
  }

  /**
   * Sanitization methods
   */
  private sanitizeErrorForClient(error: IPCError): IPCError {
    // Remove sensitive information from error details
    const sanitizedError = { ...error };
    
    if (sanitizedError.details) {
      sanitizedError.details = {
        ...sanitizedError.details,
        // Remove stack traces in production
        ...(process.env.NODE_ENV === 'production' && { stack: undefined }),
        // Remove sensitive context information
        originalError: undefined,
        context: undefined
      };
    }
    
    return sanitizedError;
  }

  private sanitizeContext(context: ErrorContext): Partial<ErrorContext> {
    return {
      channel: context.channel,
      requestId: context.requestId,
      timestamp: context.timestamp,
      executionTimeMs: context.executionTimeMs,
      retryCount: context.retryCount
      // Deliberately exclude potentially sensitive data
    };
  }

  private sanitizeError(error: unknown): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      };
    }
    
    return String(error);
  }

  private sanitizeDatabaseError(error: unknown): any {
    if (error && typeof error === 'object') {
      const dbError = error as any;
      return {
        code: dbError.code,
        errno: dbError.errno,
        message: dbError.message
        // Don't include potentially sensitive query information
      };
    }
    
    return this.sanitizeError(error);
  }

  /**
   * Fallback implementations
   */
  private async fallbackToLocalSearch(context: ErrorContext): Promise<any> {
    // This would call the local search service directly
    // Implementation depends on your service architecture
    return { results: [], fallbackUsed: true };
  }

  private async fallbackToCachedEntry(context: ErrorContext): Promise<FallbackResult> {
    // Try to get entry from cache
    // Implementation depends on your cache architecture
    return { success: false, fallbackUsed: 'cache-miss' };
  }

  private async getBasicMetrics(): Promise<any> {
    return {
      timestamp: Date.now(),
      basic: true,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * Utility methods
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getCircuitBreaker(channel: string): CircuitBreaker {
    if (!this.circuitBreakers.has(channel)) {
      this.circuitBreakers.set(channel, new CircuitBreaker());
    }
    return this.circuitBreakers.get(channel)!;
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      // Calculate error rate over last hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recentErrorCount = this.errorEvents.filter(e => e.timestamp > oneHourAgo).length;
      
      // This would need total request count to calculate proper error rate
      // For now, just track error count
      this.metrics.errorRate = recentErrorCount;
      
      // Clean up old error events
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const filteredEvents = this.errorEvents.filter(e => e.timestamp > oneDayAgo);
      this.errorEvents.splice(0, this.errorEvents.length, ...filteredEvents);
      
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Public methods for monitoring and management
   */
  getErrorMetrics(): ErrorMetrics {
    return {
      ...this.metrics,
      errorsByCode: new Map(this.metrics.errorsByCode),
      errorsByChannel: new Map(this.metrics.errorsByChannel),
      recentErrors: [...this.metrics.recentErrors]
    };
  }

  getCircuitBreakerStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [channel, breaker] of this.circuitBreakers.entries()) {
      status[channel] = breaker.getState();
    }
    
    return status;
  }

  resetCircuitBreaker(channel: string): void {
    const breaker = this.circuitBreakers.get(channel);
    if (breaker) {
      breaker.reset();
    }
  }

  resetAllCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
  }

  clearErrorHistory(): void {
    this.errorEvents.length = 0;
    this.metrics.errorsByCode.clear();
    this.metrics.errorsByChannel.clear();
    this.metrics.totalErrors = 0;
    this.metrics.criticalErrors = 0;
    this.metrics.recentErrors = [];
  }
}