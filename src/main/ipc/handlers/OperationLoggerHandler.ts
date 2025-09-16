/**
 * Operation Logger IPC Handler
 *
 * Comprehensive IPC handler for operation logging and audit trail functionality:
 * - Operation logging and tracking
 * - Decision and error logging
 * - Metrics and analytics retrieval
 * - Log search and filtering
 * - Export functionality
 * - Cleanup operations
 */

import {
  IPCHandlerFunction,
  BaseIPCRequest,
  BaseIPCResponse,
  IPCErrorCode
} from '../../../types/ipc';
import {
  OperationLoggerService,
  Operation,
  AuthorizationDecision,
  OperationError,
  OperationFilters,
  OperationMetrics,
  DateRange,
  OperationType,
  OperationStatus,
  DecisionAction,
  ErrorType,
  ErrorSeverity
} from '../../services/OperationLoggerService';
import { HandlerUtils, HandlerConfigs } from './index';

/**
 * IPC request interfaces for operation logger operations
 */
interface LogOperationIPCRequest extends BaseIPCRequest {
  operation: Omit<Operation, 'id' | 'createdAt' | 'updatedAt'>;
}

interface LogDecisionIPCRequest extends BaseIPCRequest {
  decision: Omit<AuthorizationDecision, 'id'>;
}

interface LogErrorIPCRequest extends BaseIPCRequest {
  error: Omit<OperationError, 'id'>;
}

interface GetOperationHistoryIPCRequest extends BaseIPCRequest {
  filters?: OperationFilters;
}

interface GetOperationMetricsIPCRequest extends BaseIPCRequest {
  period: DateRange;
}

interface GetOperationByIdIPCRequest extends BaseIPCRequest {
  id: string;
}

interface SearchLogsIPCRequest extends BaseIPCRequest {
  query: string;
}

interface ExportLogsIPCRequest extends BaseIPCRequest {
  format: 'csv' | 'json';
  period: DateRange;
  filePath?: string;
}

interface CleanupLogsIPCRequest extends BaseIPCRequest {
  daysToKeep?: number;
}

interface UpdateOperationIPCRequest extends BaseIPCRequest {
  operationId: string;
  updates: Partial<Operation>;
}

interface GetDecisionHistoryIPCRequest extends BaseIPCRequest {
  operationId?: string;
  userId?: string;
  period?: DateRange;
  limit?: number;
}

interface GetErrorHistoryIPCRequest extends BaseIPCRequest {
  operationId?: string;
  errorType?: ErrorType;
  severity?: ErrorSeverity;
  period?: DateRange;
  resolved?: boolean;
  limit?: number;
}

interface GetAggregatedStatsIPCRequest extends BaseIPCRequest {
  groupBy: 'hour' | 'day' | 'week' | 'month';
  period: DateRange;
  metric: 'operations' | 'errors' | 'cost' | 'responseTime';
}

/**
 * IPC response interfaces for operation logger operations
 */
interface OperationHistoryIPCResponse extends BaseIPCResponse {
  data: Operation[];
}

interface OperationMetricsIPCResponse extends BaseIPCResponse {
  data: OperationMetrics;
}

interface OperationIPCResponse extends BaseIPCResponse {
  data: Operation | null;
}

interface SearchResultsIPCResponse extends BaseIPCResponse {
  data: Operation[];
}

interface ExportResultIPCResponse extends BaseIPCResponse {
  data: { filePath: string; size: number };
}

interface CleanupResultIPCResponse extends BaseIPCResponse {
  data: { deletedCount: number };
}

interface DecisionHistoryIPCResponse extends BaseIPCResponse {
  data: AuthorizationDecision[];
}

interface ErrorHistoryIPCResponse extends BaseIPCResponse {
  data: OperationError[];
}

interface AggregatedStatsIPCResponse extends BaseIPCResponse {
  data: Array<{
    period: string;
    value: number;
    metadata?: Record<string, any>;
  }>;
}

interface ServiceStatsIPCResponse extends BaseIPCResponse {
  data: {
    uptime: number;
    totalOperations: number;
    operationsToday: number;
    errorRate: number;
    averageResponseTime: number;
    cacheHitRate: number;
    databaseSize: number;
    lastCleanup?: Date;
  };
}

/**
 * Operation Logger Handler Implementation
 */
export class OperationLoggerHandler {
  constructor(
    private operationLoggerService: OperationLoggerService
  ) {}

  /**
   * Log a new operation
   */
  handleLogOperation: IPCHandlerFunction<'operationLogger:logOperation'> = async (request) => {
    const startTime = Date.now();

    try {
      const { operation } = request as LogOperationIPCRequest;

      // Validate operation data
      if (!operation?.type || !operation?.query) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Missing required operation type or query',
          { operation }
        );
      }

      // Validate operation type
      const validOperationTypes: OperationType[] = [
        'semantic_search',
        'explain_error',
        'analyze_entry',
        'generate_summary',
        'extract_keywords',
        'classify_content',
        'translate_text',
        'improve_writing',
        'kb_search',
        'kb_create',
        'kb_update',
        'kb_delete',
        'autocomplete',
        'bulk_operation',
        'system_operation'
      ];

      if (!validOperationTypes.includes(operation.type)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          `Invalid operation type: ${operation.type}`,
          { validTypes: validOperationTypes }
        );
      }

      // Sanitize query and other text fields
      const sanitizedOperation = {
        ...operation,
        query: HandlerUtils.sanitizeString(operation.query, 5000),
        metadata: operation.metadata ? this.sanitizeMetadata(operation.metadata) : undefined
      };

      // Log the operation
      await this.operationLoggerService.logOperation(sanitizedOperation);

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        { logged: true },
        {
          operationType: operation.type,
          queryLength: sanitizedOperation.query.length
        }
      );

    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.OPERATION_FAILED,
        'Failed to log operation',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Log an authorization decision
   */
  handleLogDecision: IPCHandlerFunction<'operationLogger:logDecision'> = async (request) => {
    const startTime = Date.now();

    try {
      const { decision } = request as LogDecisionIPCRequest;

      // Validate decision data
      if (!decision?.operationId || !decision?.action || !decision?.timestamp) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Missing required decision data',
          { decision }
        );
      }

      // Validate action
      const validActions: DecisionAction[] = [
        'approve_once',
        'approve_always',
        'deny',
        'use_local_only',
        'modify_query'
      ];

      if (!validActions.includes(decision.action)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          `Invalid decision action: ${decision.action}`,
          { validActions }
        );
      }

      // Sanitize notes if provided
      const sanitizedDecision = {
        ...decision,
        notes: decision.notes ? HandlerUtils.sanitizeString(decision.notes, 1000) : undefined,
        reason: decision.reason ? HandlerUtils.sanitizeString(decision.reason, 500) : undefined
      };

      await this.operationLoggerService.logDecision(sanitizedDecision);

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        { logged: true },
        {
          action: decision.action,
          autoApproved: decision.autoApproved
        }
      );

    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.OPERATION_FAILED,
        'Failed to log decision',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Log an operation error
   */
  handleLogError: IPCHandlerFunction<'operationLogger:logError'> = async (request) => {
    const startTime = Date.now();

    try {
      const { error } = request as LogErrorIPCRequest;

      // Validate error data
      if (!error?.errorCode || !error?.errorType || !error?.message || !error?.severity || !error?.timestamp) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Missing required error data',
          { error }
        );
      }

      // Validate error type and severity
      const validErrorTypes: ErrorType[] = [
        'authorization_error',
        'validation_error',
        'database_error',
        'network_error',
        'ai_service_error',
        'cost_limit_error',
        'timeout_error',
        'system_error',
        'user_error'
      ];

      const validSeverities: ErrorSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

      if (!validErrorTypes.includes(error.errorType)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          `Invalid error type: ${error.errorType}`,
          { validTypes: validErrorTypes }
        );
      }

      if (!validSeverities.includes(error.severity)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          `Invalid error severity: ${error.severity}`,
          { validSeverities }
        );
      }

      // Sanitize error message and stack
      const sanitizedError = {
        ...error,
        message: HandlerUtils.sanitizeString(error.message, 2000),
        stack: error.stack ? HandlerUtils.sanitizeString(error.stack, 10000) : undefined
      };

      await this.operationLoggerService.logError(sanitizedError);

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        { logged: true },
        {
          errorType: error.errorType,
          severity: error.severity
        }
      );

    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.OPERATION_FAILED,
        'Failed to log error',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Get operation history with filtering
   */
  handleGetOperationHistory: IPCHandlerFunction<'operationLogger:getOperationHistory'> = async (request) => {
    const startTime = Date.now();

    try {
      const { filters = {} } = request as GetOperationHistoryIPCRequest;

      // Validate and sanitize filters
      const sanitizedFilters = this.sanitizeFilters(filters);

      const operations = await this.operationLoggerService.getOperationHistory(sanitizedFilters);

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        operations,
        {
          count: operations.length,
          hasFilters: Object.keys(filters).length > 0
        }
      ) as OperationHistoryIPCResponse;

    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        'Failed to get operation history',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Get operation metrics for a time period
   */
  handleGetOperationMetrics: IPCHandlerFunction<'operationLogger:getOperationMetrics'> = async (request) => {
    const startTime = Date.now();

    try {
      const { period } = request as GetOperationMetricsIPCRequest;

      // Validate period
      if (!period?.start || !period?.end) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Missing required period start or end date',
          { period }
        );
      }

      // Validate date range
      const start = new Date(period.start);
      const end = new Date(period.end);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Invalid date format in period',
          { period }
        );
      }

      if (start >= end) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Period start date must be before end date',
          { period }
        );
      }

      const metrics = await this.operationLoggerService.getOperationMetrics({ start, end });

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        metrics,
        {
          periodDays: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
          cached: true
        }
      ) as OperationMetricsIPCResponse;

    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        'Failed to get operation metrics',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Get a specific operation by ID
   */
  handleGetOperationById: IPCHandlerFunction<'operationLogger:getOperationById'> = async (request) => {
    const startTime = Date.now();

    try {
      const { id } = request as GetOperationByIdIPCRequest;

      if (!id || typeof id !== 'string') {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Invalid operation ID',
          { id }
        );
      }

      const operation = await this.operationLoggerService.getOperationById(id);

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        operation,
        {
          found: operation !== null
        }
      ) as OperationIPCResponse;

    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.DATABASE_ERROR,
        'Failed to get operation by ID',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Search logs with a query string
   */
  handleSearchLogs: IPCHandlerFunction<'operationLogger:searchLogs'> = async (request) => {
    const startTime = Date.now();

    try {
      const { query } = request as SearchLogsIPCRequest;

      if (!query || typeof query !== 'string') {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Invalid search query',
          { query }
        );
      }

      // Sanitize query
      const sanitizedQuery = HandlerUtils.sanitizeString(query, 200);

      const results = await this.operationLoggerService.searchLogs(sanitizedQuery);

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        results,
        {
          query: sanitizedQuery,
          resultCount: results.length
        }
      ) as SearchResultsIPCResponse;

    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.SEARCH_FAILED,
        'Failed to search logs',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Export logs to file
   */
  handleExportLogs: IPCHandlerFunction<'operationLogger:exportLogs'> = async (request) => {
    const startTime = Date.now();

    try {
      const { format, period, filePath } = request as ExportLogsIPCRequest;

      // Validate format
      if (!format || !['csv', 'json'].includes(format)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Invalid export format. Must be csv or json',
          { format }
        );
      }

      // Validate period
      if (!period?.start || !period?.end) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Missing required period start or end date',
          { period }
        );
      }

      const start = new Date(period.start);
      const end = new Date(period.end);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'Invalid date format in period',
          { period }
        );
      }

      const exportPath = await this.operationLoggerService.exportLogs(format, { start, end }, filePath);

      // Get file size
      const fs = await import('fs').then(m => m.promises);
      const stats = await fs.stat(exportPath);

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        {
          filePath: exportPath,
          size: stats.size
        },
        {
          format,
          periodDays: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        }
      ) as ExportResultIPCResponse;

    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.EXPORT_FAILED,
        'Failed to export logs',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Clean up old logs
   */
  handleCleanupLogs: IPCHandlerFunction<'operationLogger:cleanupLogs'> = async (request) => {
    const startTime = Date.now();

    try {
      const { daysToKeep } = request as CleanupLogsIPCRequest;

      // Validate daysToKeep if provided
      if (daysToKeep !== undefined && (typeof daysToKeep !== 'number' || daysToKeep < 1 || daysToKeep > 3650)) {
        return HandlerUtils.createErrorResponse(
          request.requestId,
          startTime,
          IPCErrorCode.INVALID_REQUEST_DATA,
          'daysToKeep must be a number between 1 and 3650',
          { daysToKeep }
        );
      }

      const deletedCount = await this.operationLoggerService.cleanupOldLogs(daysToKeep);

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        { deletedCount },
        {
          daysToKeep: daysToKeep || 90
        }
      ) as CleanupResultIPCResponse;

    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.CLEANUP_FAILED,
        'Failed to cleanup logs',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  /**
   * Get service health and statistics
   */
  handleGetServiceStats: IPCHandlerFunction<'operationLogger:getServiceStats'> = async (request) => {
    const startTime = Date.now();

    try {
      const health = await this.operationLoggerService.healthCheck();
      const metrics = this.operationLoggerService.getMetrics();

      const stats = {
        uptime: metrics.uptime,
        totalOperations: metrics.operationsCount,
        operationsToday: health.details?.operationsToday || 0,
        errorRate: metrics.errorRate,
        averageResponseTime: metrics.averageResponseTime,
        cacheHitRate: metrics.cacheHitRate || 0,
        databaseSize: health.details?.databaseSize || 0,
        lastCleanup: health.details?.lastCleanup
      };

      return HandlerUtils.createSuccessResponse(
        request.requestId,
        startTime,
        stats,
        {
          healthy: health.healthy,
          lastCheck: health.lastCheck
        }
      ) as ServiceStatsIPCResponse;

    } catch (error) {
      return HandlerUtils.createErrorResponse(
        request.requestId,
        startTime,
        IPCErrorCode.STATS_RETRIEVAL_FAILED,
        'Failed to get service statistics',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  };

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private sanitizeFilters(filters: OperationFilters): OperationFilters {
    const sanitized: OperationFilters = {};

    if (filters.operationId) {
      sanitized.operationId = HandlerUtils.sanitizeString(filters.operationId, 100);
    }

    if (filters.type) {
      sanitized.type = filters.type;
    }

    if (filters.subtype) {
      sanitized.subtype = HandlerUtils.sanitizeString(filters.subtype, 100);
    }

    if (filters.userId) {
      sanitized.userId = HandlerUtils.sanitizeString(filters.userId, 100);
    }

    if (filters.sessionId) {
      sanitized.sessionId = HandlerUtils.sanitizeString(filters.sessionId, 100);
    }

    if (filters.status) {
      sanitized.status = filters.status;
    }

    if (filters.dateRange) {
      sanitized.dateRange = {
        start: new Date(filters.dateRange.start),
        end: new Date(filters.dateRange.end)
      };
    }

    if (filters.severity) {
      sanitized.severity = filters.severity;
    }

    if (filters.hasError !== undefined) {
      sanitized.hasError = Boolean(filters.hasError);
    }

    if (filters.autoApproved !== undefined) {
      sanitized.autoApproved = Boolean(filters.autoApproved);
    }

    if (filters.limit && typeof filters.limit === 'number' && filters.limit > 0) {
      sanitized.limit = Math.min(filters.limit, 1000); // Cap at 1000
    }

    if (filters.offset && typeof filters.offset === 'number' && filters.offset >= 0) {
      sanitized.offset = filters.offset;
    }

    if (filters.sortBy) {
      sanitized.sortBy = filters.sortBy;
    }

    if (filters.sortOrder && ['ASC', 'DESC'].includes(filters.sortOrder)) {
      sanitized.sortOrder = filters.sortOrder;
    }

    return sanitized;
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const sanitizedKey = HandlerUtils.sanitizeString(key, 50);

      if (typeof value === 'string') {
        sanitized[sanitizedKey] = HandlerUtils.sanitizeString(value, 1000);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      } else if (value && typeof value === 'object') {
        // Recursively sanitize nested objects (with depth limit)
        sanitized[sanitizedKey] = this.sanitizeNestedObject(value, 2);
      }
    }

    return sanitized;
  }

  private sanitizeNestedObject(obj: any, depth: number): any {
    if (depth <= 0 || !obj || typeof obj !== 'object') {
      return null;
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = HandlerUtils.sanitizeString(String(key), 50);

      if (typeof value === 'string') {
        sanitized[sanitizedKey] = HandlerUtils.sanitizeString(value, 500);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[sanitizedKey] = value;
      } else if (value && typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeNestedObject(value, depth - 1);
      }
    }

    return sanitized;
  }

  /**
   * Get handler configuration
   */
  static getHandlerConfig() {
    return {
      'operationLogger:logOperation': {
        handler: 'handleLogOperation',
        config: {
          ...HandlerConfigs.WRITE_OPERATIONS,
          rateLimitConfig: { requests: 100, windowMs: 60000 },
          trackMetrics: true,
          validateInput: true,
          sanitizeInput: true
        }
      },
      'operationLogger:logDecision': {
        handler: 'handleLogDecision',
        config: {
          ...HandlerConfigs.WRITE_OPERATIONS,
          rateLimitConfig: { requests: 50, windowMs: 60000 },
          trackMetrics: true,
          validateInput: true,
          sanitizeInput: true
        }
      },
      'operationLogger:logError': {
        handler: 'handleLogError',
        config: {
          ...HandlerConfigs.WRITE_OPERATIONS,
          rateLimitConfig: { requests: 100, windowMs: 60000 },
          trackMetrics: true,
          validateInput: true,
          sanitizeInput: true
        }
      },
      'operationLogger:getOperationHistory': {
        handler: 'handleGetOperationHistory',
        config: {
          ...HandlerConfigs.READ_HEAVY,
          cacheTTL: 60000, // 1 minute
          rateLimitConfig: { requests: 30, windowMs: 60000 },
          trackMetrics: true
        }
      },
      'operationLogger:getOperationMetrics': {
        handler: 'handleGetOperationMetrics',
        config: {
          ...HandlerConfigs.READ_HEAVY,
          cacheTTL: 300000, // 5 minutes
          rateLimitConfig: { requests: 20, windowMs: 60000 },
          trackMetrics: true
        }
      },
      'operationLogger:getOperationById': {
        handler: 'handleGetOperationById',
        config: {
          ...HandlerConfigs.READ_HEAVY,
          cacheTTL: 300000, // 5 minutes
          rateLimitConfig: { requests: 50, windowMs: 60000 },
          trackMetrics: true
        }
      },
      'operationLogger:searchLogs': {
        handler: 'handleSearchLogs',
        config: {
          ...HandlerConfigs.READ_HEAVY,
          cacheTTL: 120000, // 2 minutes
          rateLimitConfig: { requests: 20, windowMs: 60000 },
          trackMetrics: true,
          validateInput: true,
          sanitizeInput: true
        }
      },
      'operationLogger:exportLogs': {
        handler: 'handleExportLogs',
        config: {
          ...HandlerConfigs.CRITICAL_OPERATIONS,
          rateLimitConfig: { requests: 5, windowMs: 300000 }, // 5 per 5 minutes
          trackMetrics: true,
          validateInput: true,
          alertOnErrors: true,
          timeout: 60000 // 1 minute timeout for exports
        }
      },
      'operationLogger:cleanupLogs': {
        handler: 'handleCleanupLogs',
        config: {
          ...HandlerConfigs.SYSTEM_OPERATIONS,
          rateLimitConfig: { requests: 2, windowMs: 3600000 }, // 2 per hour
          trackMetrics: true,
          validateInput: true,
          alertOnErrors: true,
          requireAuth: true,
          timeout: 120000 // 2 minute timeout for cleanup
        }
      },
      'operationLogger:getServiceStats': {
        handler: 'handleGetServiceStats',
        config: {
          ...HandlerConfigs.SYSTEM_OPERATIONS,
          cacheTTL: 30000, // 30 seconds
          rateLimitConfig: { requests: 60, windowMs: 60000 },
          trackMetrics: false // Avoid recursion
        }
      }
    };
  }
}

/**
 * Factory function to create operation logger handler
 */
export function createOperationLoggerHandler(operationLoggerService: OperationLoggerService): OperationLoggerHandler {
  return new OperationLoggerHandler(operationLoggerService);
}

/**
 * Export handler configuration for registration
 */
export const OperationLoggerHandlerConfig = OperationLoggerHandler.getHandlerConfig();