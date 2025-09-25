import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './SSOJWTMiddleware';
import { DatabaseManager } from '../../database/DatabaseManager';
import crypto from 'crypto';

export interface AuthError {
  code: string;
  message: string;
  statusCode: number;
  details?: any;
  retryable?: boolean;
  timestamp: Date;
  correlationId: string;
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  provider?: string;
  operation?: string;
}

export class ErrorHandlingMiddleware {
  private db: DatabaseManager;

  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  /**
   * Main error handling middleware
   */
  handle() {
    return async (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const context = this.buildErrorContext(req);
        const authError = this.normalizeError(error);
        
        // Log error
        await this.logError(authError, context);
        
        // Send appropriate response based on error type
        await this.sendErrorResponse(res, authError, context);
        
        // Additional error handling based on error type
        await this.handleErrorType(authError, context);
      } catch (handlingError) {
        console.error('Error in error handling middleware:', handlingError);
        
        // Fallback error response
        res.status(500).json({
          success: false,
          error: 'INTERNAL_SERVER_ERROR',
          message: 'An internal server error occurred',
          correlationId: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * JWT-specific error handler
   */
  handleJWTErrors() {
    return async (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!this.isJWTError(error)) {
        return next(error);
      }

      const context = this.buildErrorContext(req);
      const authError = this.normalizeJWTError(error);
      
      await this.logError(authError, context);
      
      // Special handling for JWT errors
      if (authError.code === 'TOKEN_EXPIRED') {
        res.setHeader('X-Token-Expired', 'true');
        res.setHeader('X-Refresh-Required', 'true');
      }
      
      await this.sendErrorResponse(res, authError, context);
    };
  }

  /**
   * SSO-specific error handler
   */
  handleSSOErrors() {
    return async (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!this.isSSOError(error)) {
        return next(error);
      }

      const context = this.buildErrorContext(req);
      const authError = this.normalizeSSOError(error);
      
      await this.logError(authError, context);
      
      // SSO errors might need redirect handling
      if (authError.code === 'SSO_CALLBACK_ERROR') {
        return this.handleSSOCallbackError(res, authError, context);
      }
      
      await this.sendErrorResponse(res, authError, context);
    };
  }

  /**
   * Rate limit error handler
   */
  handleRateLimitErrors() {
    return async (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!this.isRateLimitError(error)) {
        return next(error);
      }

      const context = this.buildErrorContext(req);
      const authError = this.normalizeRateLimitError(error);
      
      await this.logError(authError, context);
      
      // Set rate limit headers
      if (error.limit) {
        res.setHeader('X-RateLimit-Limit', error.limit.toString());
      }
      if (error.remaining !== undefined) {
        res.setHeader('X-RateLimit-Remaining', error.remaining.toString());
      }
      if (error.reset) {
        res.setHeader('X-RateLimit-Reset', error.reset.toString());
      }
      if (error.retryAfter) {
        res.setHeader('Retry-After', error.retryAfter.toString());
      }
      
      await this.sendErrorResponse(res, authError, context);
    };
  }

  /**
   * Validation error handler
   */
  handleValidationErrors() {
    return async (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!this.isValidationError(error)) {
        return next(error);
      }

      const context = this.buildErrorContext(req);
      const authError = this.normalizeValidationError(error);
      
      await this.logError(authError, context);
      await this.sendErrorResponse(res, authError, context);
    };
  }

  /**
   * Database error handler
   */
  handleDatabaseErrors() {
    return async (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!this.isDatabaseError(error)) {
        return next(error);
      }

      const context = this.buildErrorContext(req);
      const authError = this.normalizeDatabaseError(error);
      
      await this.logError(authError, context);
      
      // Don't expose database details in production
      if (process.env.NODE_ENV === 'production') {
        authError.message = 'A database error occurred';
        delete authError.details;
      }
      
      await this.sendErrorResponse(res, authError, context);
    };
  }

  /**
   * Provider error handler
   */
  handleProviderErrors() {
    return async (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!this.isProviderError(error)) {
        return next(error);
      }

      const context = this.buildErrorContext(req);
      const authError = this.normalizeProviderError(error);
      
      await this.logError(authError, context);
      
      // Log provider-specific metrics
      await this.logProviderError(authError, context);
      
      await this.sendErrorResponse(res, authError, context);
    };
  }

  /**
   * 404 Not Found handler
   */
  handleNotFound() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const context = this.buildErrorContext(req as AuthenticatedRequest);
      
      const authError: AuthError = {
        code: 'ENDPOINT_NOT_FOUND',
        message: `Endpoint ${req.method} ${req.path} not found`,
        statusCode: 404,
        timestamp: new Date(),
        correlationId: crypto.randomUUID(),
        retryable: false
      };
      
      await this.logError(authError, context);
      
      res.status(404).json({
        success: false,
        error: authError.code,
        message: authError.message,
        correlationId: authError.correlationId,
        timestamp: authError.timestamp.toISOString()
      });
    };
  }

  /**
   * Error normalization methods
   */
  private normalizeError(error: any): AuthError {
    const correlationId = crypto.randomUUID();
    
    // Check for known error types first
    if (this.isJWTError(error)) {
      return this.normalizeJWTError(error);
    }
    if (this.isSSOError(error)) {
      return this.normalizeSSOError(error);
    }
    if (this.isRateLimitError(error)) {
      return this.normalizeRateLimitError(error);
    }
    if (this.isValidationError(error)) {
      return this.normalizeValidationError(error);
    }
    if (this.isDatabaseError(error)) {
      return this.normalizeDatabaseError(error);
    }
    if (this.isProviderError(error)) {
      return this.normalizeProviderError(error);
    }
    
    // Generic error
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      statusCode: error.statusCode || error.status || 500,
      details: error.details,
      retryable: error.retryable || false,
      timestamp: new Date(),
      correlationId
    };
  }

  private normalizeJWTError(error: any): AuthError {
    const correlationId = crypto.randomUUID();
    
    switch (error.name) {
      case 'TokenExpiredError':
        return {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
          statusCode: 401,
          details: { expiredAt: error.expiredAt },
          retryable: true,
          timestamp: new Date(),
          correlationId
        };
      case 'JsonWebTokenError':
        return {
          code: 'TOKEN_INVALID',
          message: 'Access token is invalid',
          statusCode: 401,
          retryable: false,
          timestamp: new Date(),
          correlationId
        };
      case 'NotBeforeError':
        return {
          code: 'TOKEN_NOT_ACTIVE',
          message: 'Access token is not active yet',
          statusCode: 401,
          details: { notBefore: error.notBefore },
          retryable: true,
          timestamp: new Date(),
          correlationId
        };
      default:
        return {
          code: 'JWT_ERROR',
          message: error.message || 'JWT processing error',
          statusCode: 401,
          retryable: false,
          timestamp: new Date(),
          correlationId
        };
    }
  }

  private normalizeSSOError(error: any): AuthError {
    const correlationId = crypto.randomUUID();
    
    return {
      code: error.code || 'SSO_ERROR',
      message: this.sanitizeSSOErrorMessage(error.message || 'SSO authentication failed'),
      statusCode: error.statusCode || 401,
      details: error.details ? this.sanitizeErrorDetails(error.details) : undefined,
      retryable: error.retryable !== false,
      timestamp: new Date(),
      correlationId
    };
  }

  private normalizeRateLimitError(error: any): AuthError {
    const correlationId = crypto.randomUUID();
    
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      message: error.message || 'Rate limit exceeded',
      statusCode: 429,
      details: {
        limit: error.limit,
        remaining: error.remaining,
        reset: error.reset,
        retryAfter: error.retryAfter
      },
      retryable: true,
      timestamp: new Date(),
      correlationId
    };
  }

  private normalizeValidationError(error: any): AuthError {
    const correlationId = crypto.randomUUID();
    
    return {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      statusCode: 400,
      details: {
        errors: error.errors || [error.message]
      },
      retryable: false,
      timestamp: new Date(),
      correlationId
    };
  }

  private normalizeDatabaseError(error: any): AuthError {
    const correlationId = crypto.randomUUID();
    
    return {
      code: 'DATABASE_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'A database error occurred' 
        : (error.message || 'Database operation failed'),
      statusCode: 500,
      details: process.env.NODE_ENV === 'production' ? undefined : {
        code: error.code,
        errno: error.errno,
        sqlMessage: error.sqlMessage
      },
      retryable: true,
      timestamp: new Date(),
      correlationId
    };
  }

  private normalizeProviderError(error: any): AuthError {
    const correlationId = crypto.randomUUID();
    
    return {
      code: error.code || 'PROVIDER_ERROR',
      message: this.sanitizeProviderErrorMessage(error.message || 'Provider authentication failed'),
      statusCode: error.statusCode || 502,
      details: error.details ? this.sanitizeErrorDetails(error.details) : undefined,
      retryable: error.retryable !== false,
      timestamp: new Date(),
      correlationId
    };
  }

  /**
   * Error type detection methods
   */
  private isJWTError(error: any): boolean {
    return ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error.name);
  }

  private isSSOError(error: any): boolean {
    return error.code && error.code.startsWith('SSO_');
  }

  private isRateLimitError(error: any): boolean {
    return error.statusCode === 429 || error.code === 'RATE_LIMIT_EXCEEDED';
  }

  private isValidationError(error: any): boolean {
    return error.name === 'ValidationError' || (error.errors && Array.isArray(error.errors));
  }

  private isDatabaseError(error: any): boolean {
    return error.code && (error.code.startsWith('ER_') || error.errno !== undefined);
  }

  private isProviderError(error: any): boolean {
    return error.code && error.code.includes('PROVIDER');
  }

  /**
   * Helper methods
   */
  private buildErrorContext(req: AuthenticatedRequest): ErrorContext {
    return {
      userId: req.user?.id,
      sessionId: req.sessionId,
      ip: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      path: req.path,
      method: req.method,
      provider: req.ssoProvider,
      operation: req.headers['x-operation-type'] as string
    };
  }

  private async sendErrorResponse(res: Response, error: AuthError, context: ErrorContext): Promise<void> {
    const response = {
      success: false,
      error: error.code,
      message: error.message,
      correlationId: error.correlationId,
      timestamp: error.timestamp.toISOString(),
      ...(error.details && { details: error.details }),
      ...(error.retryable !== undefined && { retryable: error.retryable })
    };

    // Add development-specific info
    if (process.env.NODE_ENV === 'development') {
      (response as any).context = {
        path: context.path,
        method: context.method,
        ip: context.ip
      };
    }

    res.status(error.statusCode).json(response);
  }

  private async handleErrorType(error: AuthError, context: ErrorContext): Promise<void> {
    try {
      // Handle specific error types with additional actions
      switch (error.code) {
        case 'TOKEN_EXPIRED':
          await this.handleTokenExpired(context);
          break;
        case 'RATE_LIMIT_EXCEEDED':
          await this.handleRateLimitExceeded(context);
          break;
        case 'SSO_CALLBACK_ERROR':
          await this.handleSSOCallbackError(null, error, context);
          break;
        case 'DATABASE_ERROR':
          await this.handleDatabaseError(context);
          break;
        default:
          // No special handling needed
          break;
      }
    } catch (handlingError) {
      console.error('Error in type-specific error handling:', handlingError);
    }
  }

  private async handleTokenExpired(context: ErrorContext): Promise<void> {
    if (context.userId && context.sessionId) {
      // Could implement automatic session extension or cleanup
      console.log('Token expired for user:', context.userId, 'session:', context.sessionId);
    }
  }

  private async handleRateLimitExceeded(context: ErrorContext): Promise<void> {
    // Could implement temporary IP blocking or user notification
    console.warn('Rate limit exceeded from IP:', context.ip);
  }

  private async handleSSOCallbackError(res: Response | null, error: AuthError, context: ErrorContext): Promise<void> {
    // Could redirect to error page or retry SSO flow
    console.error('SSO callback error:', error.message);
    
    if (res) {
      const errorUrl = `/auth/error?code=${error.code}&message=${encodeURIComponent(error.message)}`;
      res.redirect(errorUrl);
    }
  }

  private async handleDatabaseError(context: ErrorContext): Promise<void> {
    // Could implement circuit breaker pattern or fallback
    console.error('Database error in auth context:', context);
  }

  private async logError(error: AuthError, context: ErrorContext): Promise<void> {
    try {
      await this.db.run(`
        INSERT INTO auth_error_log (
          id, correlation_id, error_code, error_message, status_code,
          user_id, session_id, ip_address, user_agent, path, method,
          provider, operation, details, retryable, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        crypto.randomUUID(),
        error.correlationId,
        error.code,
        error.message,
        error.statusCode,
        context.userId,
        context.sessionId,
        context.ip,
        context.userAgent,
        context.path,
        context.method,
        context.provider,
        context.operation,
        error.details ? JSON.stringify(error.details) : null,
        error.retryable || false,
        error.timestamp.toISOString()
      ]);
    } catch (logError) {
      console.error('Failed to log auth error to database:', logError);
    }

    // Also log to console
    console.error('Auth Error:', {
      correlationId: error.correlationId,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      context,
      timestamp: error.timestamp.toISOString()
    });
  }

  private async logProviderError(error: AuthError, context: ErrorContext): Promise<void> {
    if (!context.provider) return;
    
    try {
      await this.db.run(`
        INSERT INTO provider_error_log (
          id, provider, error_code, error_message, correlation_id,
          ip_address, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        crypto.randomUUID(),
        context.provider,
        error.code,
        error.message,
        error.correlationId,
        context.ip,
        error.timestamp.toISOString()
      ]);
    } catch (logError) {
      console.error('Failed to log provider error:', logError);
    }
  }

  private sanitizeSSOErrorMessage(message: string): string {
    // Remove sensitive information from SSO error messages
    return message
      .replace(/client_secret=[^&\s]+/gi, 'client_secret=[REDACTED]')
      .replace(/access_token=[^&\s]+/gi, 'access_token=[REDACTED]')
      .replace(/code=[^&\s]+/gi, 'code=[REDACTED]');
  }

  private sanitizeProviderErrorMessage(message: string): string {
    // Remove sensitive information from provider error messages
    return this.sanitizeSSOErrorMessage(message);
  }

  private sanitizeErrorDetails(details: any): any {
    if (!details || typeof details !== 'object') {
      return details;
    }

    const sanitized = { ...details };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'secret', 'token', 'key', 'authorization'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req as any).ip ||
      'unknown'
    );
  }
}

export const errorHandling = new ErrorHandlingMiddleware();