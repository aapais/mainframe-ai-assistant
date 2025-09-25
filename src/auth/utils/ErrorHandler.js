/**
 * Error Handler for SSO Integration
 * Centralized error handling for authentication and security errors
 */

const { SecurityLogger } = require('./SecurityLogger');

class ErrorHandler {
  constructor() {
    this.logger = SecurityLogger.getInstance();
  }

  // Custom error classes
  static UnauthorizedError = class extends Error {
    constructor(message = 'Authentication required') {
      super(message);
      this.name = 'UnauthorizedError';
      this.statusCode = 401;
    }
  };

  static ForbiddenError = class extends Error {
    constructor(message = 'Access forbidden') {
      super(message);
      this.name = 'ForbiddenError';
      this.statusCode = 403;
    }
  };

  static SSOProviderError = class extends Error {
    constructor(message = 'SSO provider error', provider) {
      super(message);
      this.name = 'SSOProviderError';
      this.statusCode = 502;
      this.provider = provider;
    }
  };

  static ValidationError = class extends Error {
    constructor(message = 'Validation error', field) {
      super(message);
      this.name = 'ValidationError';
      this.statusCode = 400;
      this.field = field;
    }
  };

  static RateLimitError = class extends Error {
    constructor(message = 'Rate limit exceeded') {
      super(message);
      this.name = 'RateLimitError';
      this.statusCode = 429;
    }
  };

  // Handle different types of errors
  handleError(error, req, res, next) {
    // Log error details
    this.logger.error('Application error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    });

    // Determine error response based on error type
    switch (error.name) {
      case 'UnauthorizedError':
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });

      case 'ForbiddenError':
        return res.status(403).json({
          success: false,
          error: 'Access forbidden',
          code: 'ACCESS_FORBIDDEN'
        });

      case 'SSOProviderError':
        this.logger.logSecurityViolation('sso_provider_error', {
          provider: error.provider,
          error: error.message
        }, 'high');
        return res.status(502).json({
          success: false,
          error: 'SSO provider unavailable',
          code: 'SSO_PROVIDER_ERROR'
        });

      case 'ValidationError':
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR',
          field: error.field
        });

      case 'RateLimitError':
        this.logger.logSecurityViolation('rate_limit_exceeded', {
          ip: req.ip,
          path: req.path
        }, 'medium');
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED'
        });

      case 'JsonWebTokenError':
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });

      case 'TokenExpiredError':
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });

      default:
        // Handle unknown errors safely
        const isDevelopment = process.env.NODE_ENV !== 'production';
        return res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          ...(isDevelopment && { details: error.message })
        });
    }
  }

  // Async error wrapper
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Security error handler
  handleSecurityError(type, details, req) {
    this.logger.logSecurityViolation(type, {
      ...details,
      ip: req?.ip,
      userAgent: req?.get('User-Agent'),
      path: req?.path,
      method: req?.method
    });
  }
}

// Error handling middleware
const errorHandler = new ErrorHandler();

const errorMiddleware = (error, req, res, next) => {
  errorHandler.handleError(error, req, res, next);
};

// Export error classes and handler
module.exports = {
  ErrorHandler,
  errorMiddleware,
  UnauthorizedError: ErrorHandler.UnauthorizedError,
  ForbiddenError: ErrorHandler.ForbiddenError,
  SSOProviderError: ErrorHandler.SSOProviderError,
  ValidationError: ErrorHandler.ValidationError,
  RateLimitError: ErrorHandler.RateLimitError
};