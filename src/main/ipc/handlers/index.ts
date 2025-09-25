/**
 * IPC Handlers Index
 *
 * Central export for all IPC handlers and related utilities.
 */

// Export all handlers
export { KnowledgeBaseHandler } from './KnowledgeBaseHandler';
export { SearchHandler } from './SearchHandler';
export { MetricsHandler } from './MetricsHandler';
export { CategoryHandler } from './CategoryHandler';
export { TagHandler } from './TagHandler';
export { AutocompleteHandler } from './AutocompleteHandler';
export { BulkOperationsHandler } from './BulkOperationsHandler';
export { RealtimeHandler } from './RealtimeHandler';
export { AuthorizationHandler } from './AuthorizationHandler';

// Export main components
export { IPCHandlerRegistry } from '../IPCHandlerRegistry';
export { IPCMainProcess, createIPCMainProcess } from '../IPCMainProcess';
export { IPCSecurityManager } from '../security/IPCSecurityManager';

// Re-export types for convenience
export type {
  IPCHandlerFunction,
  IPCHandlerConfig,
  BaseIPCRequest,
  BaseIPCResponse,
  IPCChannel,
  IPCError,
  IPCErrorCode,
} from '../../../types/ipc';

/**
 * Handler creation utilities
 */
export const HandlerUtils = {
  /**
   * Create a simple error response
   */
  createErrorResponse: (
    requestId: string,
    startTime: number,
    code: string,
    message: string,
    details?: any
  ) => ({
    success: false,
    requestId,
    timestamp: Date.now(),
    executionTime: Date.now() - startTime,
    error: {
      code,
      message,
      details,
      severity: 'medium' as const,
      retryable: false,
    },
  }),

  /**
   * Create a success response
   */
  createSuccessResponse: <T>(requestId: string, startTime: number, data: T, metadata?: any) => ({
    success: true,
    requestId,
    timestamp: Date.now(),
    executionTime: Date.now() - startTime,
    data,
    metadata: {
      cached: false,
      batched: false,
      streamed: false,
      ...metadata,
    },
  }),

  /**
   * Validate UUID format
   */
  isValidUUID: (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  /**
   * Generate cache key from arguments
   */
  generateCacheKey: (prefix: string, ...args: any[]): string => {
    const key = `${prefix}:${JSON.stringify(args)}`;
    return Buffer.from(key).toString('base64');
  },

  /**
   * Sanitize string input
   */
  sanitizeString: (input: string, maxLength: number = 1000): string => {
    return input
      .trim()
      .substring(0, maxLength)
      .replace(/[<>]/g, '') // Remove potential HTML
      .replace(/['"]/g, ''); // Remove quotes
  },
};

/**
 * Handler configuration presets
 */
export const HandlerConfigs = {
  // High-frequency, cacheable operations
  READ_HEAVY: {
    cacheable: true,
    cacheTTL: 300000, // 5 minutes
    rateLimitConfig: { requests: 200, windowMs: 60000 },
    trackMetrics: true,
    validateInput: true,
    sanitizeInput: true,
  },

  // Write operations with validation
  WRITE_OPERATIONS: {
    cacheable: false,
    rateLimitConfig: { requests: 20, windowMs: 60000 },
    trackMetrics: true,
    validateInput: true,
    sanitizeInput: true,
    alertOnErrors: true,
  },

  // Search operations with AI
  SEARCH_OPERATIONS: {
    cacheable: true,
    cacheTTL: 600000, // 10 minutes
    rateLimitConfig: { requests: 50, windowMs: 60000 },
    trackMetrics: true,
    validateInput: true,
    logRequests: false,
  },

  // System operations
  SYSTEM_OPERATIONS: {
    cacheable: true,
    cacheTTL: 30000, // 30 seconds
    rateLimitConfig: { requests: 60, windowMs: 60000 },
    trackMetrics: true,
    requireAuth: false,
  },

  // Critical operations
  CRITICAL_OPERATIONS: {
    cacheable: false,
    rateLimitConfig: { requests: 5, windowMs: 60000 },
    trackMetrics: true,
    validateInput: true,
    sanitizeInput: true,
    requireAuth: true,
    alertOnErrors: true,
  },
} as const;
