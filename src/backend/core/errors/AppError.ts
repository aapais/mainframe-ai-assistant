/**
 * Application Error Classes and Utilities
 * Comprehensive error handling system with standardized error codes
 */

/**
 * Standard error codes used throughout the application
 */
export enum ErrorCode {
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Resource errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',

  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_CONSTRAINT_ERROR = 'DATABASE_CONSTRAINT_ERROR',

  // Cache errors
  CACHE_ERROR = 'CACHE_ERROR',
  CACHE_CONNECTION_ERROR = 'CACHE_CONNECTION_ERROR',

  // Search errors
  SEARCH_ERROR = 'SEARCH_ERROR',
  INDEX_ERROR = 'INDEX_ERROR',

  // Authentication/Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // File/IO errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // Service errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

/**
 * Enhanced AppError class with comprehensive error handling
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly details?: Record<string, any>;

  constructor(
    messageOrCode: string | ErrorCode,
    codeOrStatusCode?: string | number,
    statusCodeOrDetails?: number | Record<string, any>,
    details?: Record<string, any>
  ) {
    // Handle different constructor signatures for backward compatibility
    let message: string;
    let code: string;
    let statusCode: number;
    let errorDetails: Record<string, any> | undefined;

    if (
      typeof messageOrCode === 'string' &&
      Object.values(ErrorCode).includes(messageOrCode as ErrorCode)
    ) {
      // New signature: AppError(ErrorCode, message, statusCode?, details?)
      code = messageOrCode;
      message = typeof codeOrStatusCode === 'string' ? codeOrStatusCode : messageOrCode;
      statusCode = typeof statusCodeOrDetails === 'number' ? statusCodeOrDetails : 500;
      errorDetails = typeof statusCodeOrDetails === 'object' ? statusCodeOrDetails : details;
    } else {
      // Legacy signature: AppError(message, code?, statusCode?, details?)
      message = messageOrCode;
      code = typeof codeOrStatusCode === 'string' ? codeOrStatusCode : ErrorCode.UNKNOWN_ERROR;
      statusCode =
        typeof codeOrStatusCode === 'number'
          ? codeOrStatusCode
          : typeof statusCodeOrDetails === 'number'
            ? statusCodeOrDetails
            : 500;
      errorDetails = typeof statusCodeOrDetails === 'object' ? statusCodeOrDetails : details;
    }

    super(message);

    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.timestamp = new Date();
    this.details = errorDetails;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert error to JSON representation
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
      stack: this.stack,
    };
  }

  /**
   * Create a not found error
   */
  static notFound(message = 'Resource not found', details?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.RESOURCE_NOT_FOUND, 404, details);
  }

  /**
   * Create a bad request error
   */
  static badRequest(message = 'Bad request', details?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }

  /**
   * Create an internal server error
   */
  static internalServer(
    message = 'Internal server error',
    details?: Record<string, any>
  ): AppError {
    return new AppError(message, ErrorCode.INTERNAL_ERROR, 500, details);
  }

  /**
   * Create an unauthorized error
   */
  static unauthorized(message = 'Unauthorized', details?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.UNAUTHORIZED, 401, details);
  }

  /**
   * Create a forbidden error
   */
  static forbidden(message = 'Forbidden', details?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.FORBIDDEN, 403, details);
  }

  /**
   * Create a validation error
   */
  static validation(message = 'Validation failed', details?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }

  /**
   * Create a database error
   */
  static database(message = 'Database error', details?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.DATABASE_ERROR, 500, details);
  }

  /**
   * Create a cache error
   */
  static cache(message = 'Cache error', details?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.CACHE_ERROR, 500, details);
  }

  /**
   * Create a service unavailable error
   */
  static serviceUnavailable(
    message = 'Service unavailable',
    details?: Record<string, any>
  ): AppError {
    return new AppError(message, ErrorCode.SERVICE_UNAVAILABLE, 503, details);
  }

  /**
   * Create a timeout error
   */
  static timeout(message = 'Request timeout', details?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.TIMEOUT_ERROR, 408, details);
  }

  /**
   * Create a rate limit error
   */
  static rateLimit(message = 'Rate limit exceeded', details?: Record<string, any>): AppError {
    return new AppError(message, ErrorCode.RATE_LIMIT_EXCEEDED, 429, details);
  }
}

/**
 * Error handling utilities
 */
export class ErrorUtils {
  /**
   * Check if an error is operational (known/expected)
   */
  static isOperational(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  /**
   * Convert any error to AppError
   */
  static toAppError(error: unknown, defaultMessage = 'An unexpected error occurred'): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message || defaultMessage, ErrorCode.UNKNOWN_ERROR, 500, {
        originalError: error.name,
        stack: error.stack,
      });
    }

    if (typeof error === 'string') {
      return new AppError(error, ErrorCode.UNKNOWN_ERROR, 500);
    }

    return new AppError(defaultMessage, ErrorCode.UNKNOWN_ERROR, 500, { originalError: error });
  }

  /**
   * Get HTTP status code from error
   */
  static getStatusCode(error: Error): number {
    if (error instanceof AppError) {
      return error.statusCode;
    }
    return 500;
  }

  /**
   * Get error code from error
   */
  static getErrorCode(error: Error): string {
    if (error instanceof AppError) {
      return error.code;
    }
    return ErrorCode.UNKNOWN_ERROR;
  }

  /**
   * Format error for logging
   */
  static formatForLogging(error: Error): Record<string, any> {
    const baseInfo = {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };

    if (error instanceof AppError) {
      return {
        ...baseInfo,
        code: error.code,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        timestamp: error.timestamp,
        details: error.details,
      };
    }

    return baseInfo;
  }

  /**
   * Check if error is a specific type
   */
  static isErrorCode(error: Error, code: ErrorCode): boolean {
    return error instanceof AppError && error.code === code;
  }

  /**
   * Create error from database constraint violation
   */
  static fromDatabaseConstraint(constraintName: string, details?: Record<string, any>): AppError {
    const message = `Database constraint violation: ${constraintName}`;
    return new AppError(message, ErrorCode.DATABASE_CONSTRAINT_ERROR, 400, {
      constraint: constraintName,
      ...details,
    });
  }

  /**
   * Create error from validation failure
   */
  static fromValidation(field: string, reason: string, value?: any): AppError {
    const message = `Validation failed for field '${field}': ${reason}`;
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 400, {
      field,
      reason,
      value,
    });
  }

  /**
   * Aggregate multiple validation errors
   */
  static aggregateValidationErrors(
    errors: Array<{ field: string; reason: string; value?: any }>
  ): AppError {
    const message = `Validation failed for ${errors.length} field(s)`;
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 400, {
      errors,
    });
  }
}

// Default export for backward compatibility
export default AppError;
