/**
 * IPC Handler Registry
 *
 * Central registry for managing IPC handlers with performance monitoring,
 * error handling, and security validation.
 */

import { EventEmitter } from 'events';
import type { IpcMainInvokeEvent } from 'electron';
import {
  IPCChannel,
  IPCHandlerFunction,
  IPCHandlerConfig,
  BaseIPCRequest,
  BaseIPCResponse,
  IPCError,
  IPCErrorCode,
  PerformanceMetrics,
  ChannelMetrics,
} from '../../types/ipc';
import { IPCSecurityManager } from './security/IPCSecurityManager';
import { AppError } from '../../backend/core/errors/AppError';

interface HandlerRegistration<T extends IPCChannel> {
  handler: IPCHandlerFunction<T>;
  config: IPCHandlerConfig;
  metrics: ChannelMetrics;
}

interface ExecutionContext {
  requestId: string;
  channel: string;
  startTime: number;
  userId?: string;
  sessionId?: string;
}

/**
 * IPC Handler Registry with comprehensive request management
 */
export class IPCHandlerRegistry extends EventEmitter {
  private handlers = new Map<string, HandlerRegistration<any>>();
  private executionMetrics = new Map<string, ChannelMetrics>();
  private activeRequests = new Map<string, ExecutionContext>();
  private securityManager: IPCSecurityManager;

  constructor(securityManager: IPCSecurityManager) {
    super();
    this.securityManager = securityManager;
    this.initializeMetrics();
    this.startMetricsCollection();
  }

  /**
   * Register an IPC handler with configuration
   */
  register<T extends IPCChannel>(
    channel: T,
    handler: IPCHandlerFunction<T>,
    config: IPCHandlerConfig = {}
  ): void {
    if (this.handlers.has(channel)) {
      throw new Error(`Handler already registered for channel: ${channel}`);
    }

    const registration: HandlerRegistration<T> = {
      handler,
      config: {
        // Default configuration
        batchable: false,
        batchSize: 10,
        batchDelay: 100,
        streamable: false,
        streamChunkSize: 1024 * 1024, // 1MB
        cacheable: false,
        cacheTTL: 300000, // 5 minutes
        requireAuth: false,
        allowedRoles: [],
        rateLimitConfig: {
          requests: 100,
          windowMs: 60000, // 1 minute
        },
        validateInput: true,
        sanitizeInput: true,
        trackMetrics: true,
        logRequests: false,
        alertOnErrors: false,
        ...config,
      },
      metrics: this.initializeChannelMetrics(),
    };

    this.handlers.set(channel, registration);
    this.executionMetrics.set(channel, this.initializeChannelMetrics());

    console.log(`✅ Registered IPC handler for channel: ${channel}`);
    this.emit('handler-registered', { channel, config: registration.config });
  }

  /**
   * Unregister an IPC handler
   */
  unregister(channel: IPCChannel): void {
    if (!this.handlers.has(channel)) {
      console.warn(`No handler registered for channel: ${channel}`);
      return;
    }

    this.handlers.delete(channel);
    this.executionMetrics.delete(channel);

    console.log(`🗑️ Unregistered IPC handler for channel: ${channel}`);
    this.emit('handler-unregistered', { channel });
  }

  /**
   * Execute an IPC request with comprehensive handling
   */
  async execute<T extends IPCChannel>(
    channel: T,
    request: any,
    context?: {
      userId?: string;
      sessionId?: string;
      clientInfo?: any;
    }
  ): Promise<BaseIPCResponse> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    const executionContext: ExecutionContext = {
      requestId: executionId,
      channel,
      startTime,
      userId: context?.userId,
      sessionId: context?.sessionId,
    };

    this.activeRequests.set(executionId, executionContext);

    try {
      // Get handler registration
      const registration = this.handlers.get(channel);
      if (!registration) {
        return this.createErrorResponse(
          executionId,
          startTime,
          IPCErrorCode.HANDLER_NOT_FOUND,
          `No handler registered for channel: ${channel}`
        );
      }

      // Security validation
      const securityResult = await this.securityManager.validateRequest(
        channel,
        [request],
        context
      );

      if (!securityResult.valid) {
        this.updateMetrics(
          channel,
          startTime,
          false,
          securityResult.error?.code || IPCErrorCode.VALIDATION_FAILED
        );
        return this.createErrorResponse(
          executionId,
          startTime,
          securityResult.error?.code || IPCErrorCode.VALIDATION_FAILED,
          securityResult.error?.message || 'Security validation failed',
          securityResult.error?.details
        );
      }

      // Use sanitized arguments if available
      const sanitizedRequest = securityResult.sanitizedArgs?.[0] || request;

      // Emit request start event
      this.emit('request:start', { channel, requestId: executionId });

      // Log request if enabled
      if (registration.config.logRequests) {
        console.log(`📥 IPC Request [${channel}]:`, {
          requestId: executionId,
          timestamp: new Date().toISOString(),
          userId: context?.userId,
          sanitized: !!securityResult.sanitizedArgs,
        });
      }

      // Execute handler with timeout
      const timeoutMs = this.getTimeoutForChannel(channel);
      const response = await this.executeWithTimeout(
        registration.handler,
        sanitizedRequest,
        timeoutMs
      );

      // Update metrics for successful execution
      this.updateMetrics(channel, startTime, true);

      // Emit success event
      this.emit('request:complete', {
        channel,
        requestId: executionId,
        success: true,
        duration: Date.now() - startTime,
      });

      // Add metadata to response
      const enhancedResponse = {
        ...response,
        requestId: executionId,
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        metadata: {
          cached: false,
          batched: false,
          streamed: false,
          performanceMetrics: {
            totalTime: Date.now() - startTime,
            validationTime: securityResult.sanitizedArgs ? 10 : 0, // Estimate
          },
          ...response.metadata,
        },
      };

      return enhancedResponse;
    } catch (error) {
      // Update metrics for failed execution
      this.updateMetrics(channel, startTime, false, 'EXECUTION_ERROR');

      // Handle different error types
      const errorCode = this.getErrorCode(error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Emit error event
      this.emit('request:complete', {
        channel,
        requestId: executionId,
        success: false,
        duration: Date.now() - startTime,
      });

      this.emit('error', {
        error: {
          code: errorCode,
          message: errorMessage,
          details: error,
        },
        channel,
        requestId: executionId,
      });

      // Log error
      console.error(`❌ IPC Handler Error [${channel}]:`, {
        requestId: executionId,
        error: errorMessage,
        duration: Date.now() - startTime,
      });

      return this.createErrorResponse(executionId, startTime, errorCode, errorMessage, {
        originalError: error instanceof Error ? error.stack : error,
      });
    } finally {
      this.activeRequests.delete(executionId);
    }
  }

  /**
   * Get handler metrics for a specific channel
   */
  getChannelMetrics(channel: IPCChannel): ChannelMetrics | undefined {
    return this.executionMetrics.get(channel);
  }

  /**
   * Get all handler metrics
   */
  getAllMetrics(): Record<string, ChannelMetrics> {
    const metrics: Record<string, ChannelMetrics> = {};
    this.executionMetrics.forEach((value, key) => {
      metrics[key] = value;
    });
    return metrics;
  }

  /**
   * Get real-time system metrics
   */
  getRealTimeMetrics(): {
    activeRequests: number;
    totalHandlers: number;
    averageResponseTime: number;
    errorRate: number;
    throughputPerSecond: number;
  } {
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    // Calculate metrics across all channels
    let totalRequests = 0;
    let totalErrors = 0;
    let totalExecutionTime = 0;
    let recentRequests = 0;

    this.executionMetrics.forEach(metrics => {
      totalRequests += metrics.totalRequests;
      totalErrors += metrics.errorCount;
      totalExecutionTime += metrics.totalExecutionTime;

      // Count recent requests (last minute)
      if (now - metrics.lastRequestTime < windowMs) {
        recentRequests += metrics.throughputPerSecond;
      }
    });

    return {
      activeRequests: this.activeRequests.size,
      totalHandlers: this.handlers.size,
      averageResponseTime: totalRequests > 0 ? totalExecutionTime / totalRequests : 0,
      errorRate: totalRequests > 0 ? totalErrors / totalRequests : 0,
      throughputPerSecond: recentRequests,
    };
  }

  /**
   * Get detailed performance report
   */
  getPerformanceReport(): {
    timestamp: number;
    channels: Array<{ channel: string; healthScore: number } & ChannelMetrics>;
    systemMetrics: ReturnType<IPCHandlerRegistry['getRealTimeMetrics']>;
    recommendations: string[];
  } {
    const channels: Array<{ channel: string; healthScore: number } & ChannelMetrics> = [];
    const recommendations: string[] = [];

    this.executionMetrics.forEach((metrics, channel) => {
      const healthScore = this.calculateChannelHealthScore(metrics);
      channels.push({
        channel,
        healthScore,
        ...metrics,
      });

      // Generate recommendations
      if (healthScore < 70) {
        recommendations.push(`Channel ${channel} has poor performance (health: ${healthScore}%)`);
      }

      if (metrics.errorRate > 0.1) {
        recommendations.push(
          `Channel ${channel} has high error rate: ${(metrics.errorRate * 100).toFixed(1)}%`
        );
      }

      if (metrics.p95ExecutionTime > 5000) {
        recommendations.push(
          `Channel ${channel} has slow response times (P95: ${metrics.p95ExecutionTime}ms)`
        );
      }
    });

    // System-level recommendations
    const systemMetrics = this.getRealTimeMetrics();
    if (systemMetrics.errorRate > 0.05) {
      recommendations.push(
        `System-wide error rate is high: ${(systemMetrics.errorRate * 100).toFixed(1)}%`
      );
    }

    if (systemMetrics.activeRequests > 100) {
      recommendations.push('High number of active requests - consider scaling');
    }

    return {
      timestamp: Date.now(),
      channels: channels.sort((a, b) => b.healthScore - a.healthScore),
      systemMetrics,
      recommendations,
    };
  }

  /**
   * Shutdown the registry gracefully
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down IPC Handler Registry...');

    // Wait for active requests to complete (with timeout)
    const shutdownTimeout = 5000; // 5 seconds
    const startTime = Date.now();

    while (this.activeRequests.size > 0 && Date.now() - startTime < shutdownTimeout) {
      console.log(`⏳ Waiting for ${this.activeRequests.size} active requests to complete...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.activeRequests.size > 0) {
      console.warn(`⚠️ Forcing shutdown with ${this.activeRequests.size} active requests`);
    }

    // Clear all handlers
    this.handlers.clear();
    this.executionMetrics.clear();
    this.activeRequests.clear();

    console.log('✅ IPC Handler Registry shut down successfully');
  }

  // Private methods

  private async executeWithTimeout<T>(
    handler: IPCHandlerFunction<any>,
    request: any,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      handler(request),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Handler execution timeout')), timeoutMs);
      }),
    ]);
  }

  private getTimeoutForChannel(channel: string): number {
    const registration = this.handlers.get(channel);

    // Channel-specific timeouts
    if (channel.startsWith('kb:search:ai')) return 10000; // 10s for AI
    if (channel.startsWith('system:')) return 5000; // 5s for system operations
    if (channel.startsWith('patterns:')) return 15000; // 15s for pattern detection

    return registration?.config.rateLimitConfig?.windowMs || 30000; // Default 30s
  }

  private updateMetrics(
    channel: string,
    startTime: number,
    success: boolean,
    errorCode?: string
  ): void {
    const metrics = this.executionMetrics.get(channel);
    if (!metrics) return;

    const executionTime = Date.now() - startTime;

    metrics.totalRequests++;
    metrics.totalExecutionTime += executionTime;
    metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.totalRequests;
    metrics.lastRequestTime = Date.now();

    if (success) {
      metrics.successCount++;
    } else {
      metrics.errorCount++;
    }

    metrics.errorRate = metrics.errorCount / metrics.totalRequests;

    // Update percentiles (simplified)
    this.updateExecutionTimePercentiles(metrics, executionTime);

    // Update throughput (requests per second)
    metrics.throughputPerSecond = this.calculateThroughput(metrics);
  }

  private updateExecutionTimePercentiles(metrics: ChannelMetrics, executionTime: number): void {
    // Simplified percentile calculation
    // In production, you'd want a proper percentile calculation with sampling
    metrics.p50ExecutionTime = (metrics.p50ExecutionTime + executionTime) / 2;
    metrics.p95ExecutionTime = Math.max(metrics.p95ExecutionTime, executionTime);
    metrics.p99ExecutionTime = Math.max(metrics.p99ExecutionTime, executionTime);
  }

  private calculateThroughput(metrics: ChannelMetrics): number {
    const windowMs = 60000; // 1 minute
    const now = Date.now();

    if (now - metrics.lastRequestTime > windowMs) {
      return 0;
    }

    // Simplified throughput calculation
    // In production, you'd maintain a sliding window
    return (
      metrics.totalRequests /
      ((now - (metrics.lastRequestTime - metrics.totalExecutionTime)) / 1000)
    );
  }

  private calculateChannelHealthScore(metrics: ChannelMetrics): number {
    let score = 100;

    // Penalize high error rates
    score -= metrics.errorRate * 50;

    // Penalize slow response times
    if (metrics.averageExecutionTime > 1000) {
      score -= 20;
    }
    if (metrics.averageExecutionTime > 5000) {
      score -= 30;
    }

    // Penalize very high or very low usage
    if (metrics.throughputPerSecond > 100) {
      score -= 10; // High load
    }
    if (metrics.totalRequests < 10) {
      score -= 5; // Low usage might indicate issues
    }

    return Math.max(0, Math.min(100, score));
  }

  private createErrorResponse(
    requestId: string,
    startTime: number,
    code: IPCErrorCode,
    message: string,
    details?: any
  ): BaseIPCResponse {
    return {
      success: false,
      requestId,
      timestamp: Date.now(),
      executionTime: Date.now() - startTime,
      error: {
        code,
        message,
        details,
        severity: this.getErrorSeverity(code),
        retryable: this.isRetryableError(code),
      },
    };
  }

  private getErrorCode(error: any): IPCErrorCode {
    if (error instanceof AppError) {
      return error.code as IPCErrorCode;
    }

    if (error?.code) {
      return error.code as IPCErrorCode;
    }

    if (error?.message?.includes('timeout')) {
      return IPCErrorCode.TIMEOUT;
    }

    return IPCErrorCode.HANDLER_ERROR;
  }

  private getErrorSeverity(code: IPCErrorCode): 'low' | 'medium' | 'high' | 'critical' {
    const criticalErrors = [
      IPCErrorCode.DATABASE_ERROR,
      IPCErrorCode.UNHANDLED_REJECTION,
      IPCErrorCode.MEMORY_ERROR,
    ];

    const highErrors = [
      IPCErrorCode.HANDLER_ERROR,
      IPCErrorCode.EXTERNAL_SERVICE_ERROR,
      IPCErrorCode.NETWORK_ERROR,
    ];

    const mediumErrors = [
      IPCErrorCode.VALIDATION_FAILED,
      IPCErrorCode.TIMEOUT,
      IPCErrorCode.CACHE_ERROR,
    ];

    if (criticalErrors.includes(code)) return 'critical';
    if (highErrors.includes(code)) return 'high';
    if (mediumErrors.includes(code)) return 'medium';
    return 'low';
  }

  private isRetryableError(code: IPCErrorCode): boolean {
    const retryableErrors = [
      IPCErrorCode.TIMEOUT,
      IPCErrorCode.NETWORK_ERROR,
      IPCErrorCode.EXTERNAL_SERVICE_ERROR,
      IPCErrorCode.DATABASE_ERROR,
    ];

    return retryableErrors.includes(code);
  }

  private initializeChannelMetrics(): ChannelMetrics {
    return {
      totalRequests: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      successCount: 0,
      errorCount: 0,
      errorRate: 0,
      p50ExecutionTime: 0,
      p95ExecutionTime: 0,
      p99ExecutionTime: 0,
      throughputPerSecond: 0,
      lastRequestTime: 0,
    };
  }

  private initializeMetrics(): void {
    // Initialize metrics for common channels
    const commonChannels = [
      'kb:search:local',
      'kb:search:ai',
      'kb:entry:get',
      'kb:entry:create',
      'system:metrics:get',
      'system:health:check',
    ];

    commonChannels.forEach(channel => {
      this.executionMetrics.set(channel, this.initializeChannelMetrics());
    });
  }

  private startMetricsCollection(): void {
    // Update metrics every 30 seconds
    setInterval(() => {
      this.emit('metrics:updated', {
        timestamp: Date.now(),
        metrics: this.getRealTimeMetrics(),
      });
    }, 30000);
  }

  private generateExecutionId(): string {
    return `ipc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
