/**
 * Request Validator - Comprehensive Input Validation
 * High-performance validation with security hardening and detailed error reporting
 */

import { z } from 'zod';

export class ValidationError extends Error {
  public readonly code = 'VALIDATION_ERROR';
  public readonly details: ValidationErrorDetail[];

  constructor(message: string, details: ValidationErrorDetail[]) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

/**
 * Advanced Request Validator with security hardening
 * Features:
 * - Schema-based validation using Zod
 * - SQL injection protection
 * - XSS prevention
 * - Input sanitization
 * - Rate limit validation
 * - File upload validation
 * - Custom validation rules
 */
export class RequestValidator {
  private readonly maxQueryLength = 500;
  private readonly maxStringLength = 1000;
  private readonly allowedCategories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'];
  private readonly sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(UNION\s+SELECT)/i,
    /(\-\-|\;|\||\*)/,
    /(0x[0-9a-fA-F]+)/,
    /(CHAR\(|VARCHAR\()/i,
    /(CAST\(|CONVERT\()/i,
  ];

  private readonly xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<img[^>]+src[^>]*>/gi,
  ];

  // Validation schemas
  private readonly searchRequestSchema = z.object({
    query: z
      .string()
      .min(1, 'Query is required')
      .max(this.maxQueryLength, `Query must be less than ${this.maxQueryLength} characters`)
      .transform(str => str.trim()),
    options: z
      .object({
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        category: z
          .enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'] as const)
          .optional(),
        includeArchived: z.boolean().optional(),
        fuzzyThreshold: z.number().min(0.1).max(1.0).optional(),
        useAI: z.boolean().optional(),
      })
      .optional(),
    context: z
      .object({
        userId: z.string().uuid().optional(),
        sessionId: z.string().optional(),
        userAgent: z.string().max(500).optional(),
      })
      .optional(),
  });

  private readonly autocompleteRequestSchema = z.object({
    q: z
      .string()
      .min(1, 'Query parameter "q" is required')
      .max(100, 'Query must be less than 100 characters')
      .transform(str => str.trim()),
    limit: z
      .string()
      .transform(str => parseInt(str, 10))
      .pipe(z.number().int().min(1).max(20))
      .optional(),
    category: z.enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'] as const).optional(),
  });

  private readonly historyRequestSchema = z.object({
    userId: z.string().uuid().optional(),
    limit: z
      .string()
      .transform(str => parseInt(str, 10))
      .pipe(z.number().int().min(1).max(200))
      .optional(),
    offset: z
      .string()
      .transform(str => parseInt(str, 10))
      .pipe(z.number().int().min(0))
      .optional(),
    timeframe: z.enum(['1h', '6h', '12h', '1d', '3d', '7d', '30d']).optional(),
  });

  private readonly metricsRequestSchema = z.object({
    timeframe: z.enum(['1h', '6h', '1d', '7d', '30d']).optional(),
    granularity: z.enum(['5m', '15m', '1h', '1d']).optional(),
    userId: z.string().uuid().optional(),
  });

  /**
   * Validate search request
   */
  validateSearchRequest(data: any): void {
    try {
      // Security validation first
      this.performSecurityValidation(data);

      // Schema validation
      const result = this.searchRequestSchema.safeParse(data);
      if (!result.success) {
        this.throwValidationError('Invalid search request', result.error.issues);
      }

      // Additional business logic validation
      this.validateBusinessRules(result.data);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Search request validation failed', [
        {
          field: 'request',
          message: error.message || 'Unknown validation error',
        },
      ]);
    }
  }

  /**
   * Validate autocomplete request
   */
  validateAutocompleteRequest(data: any): void {
    try {
      // Security validation
      this.performSecurityValidation(data);

      // Schema validation
      const result = this.autocompleteRequestSchema.safeParse(data);
      if (!result.success) {
        this.throwValidationError('Invalid autocomplete request', result.error.issues);
      }

      // Rate limiting validation (autocomplete should be fast and frequent)
      this.validateAutocompleteRateLimit(result.data);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Autocomplete request validation failed', [
        {
          field: 'request',
          message: error.message || 'Unknown validation error',
        },
      ]);
    }
  }

  /**
   * Validate history request
   */
  validateHistoryRequest(data: any): void {
    try {
      // Security validation
      this.performSecurityValidation(data);

      // Schema validation
      const result = this.historyRequestSchema.safeParse(data);
      if (!result.success) {
        this.throwValidationError('Invalid history request', result.error.issues);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('History request validation failed', [
        {
          field: 'request',
          message: error.message || 'Unknown validation error',
        },
      ]);
    }
  }

  /**
   * Validate metrics request
   */
  validateMetricsRequest(data: any): void {
    try {
      // Security validation
      this.performSecurityValidation(data);

      // Schema validation
      const result = this.metricsRequestSchema.safeParse(data);
      if (!result.success) {
        this.throwValidationError('Invalid metrics request', result.error.issues);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Metrics request validation failed', [
        {
          field: 'request',
          message: error.message || 'Unknown validation error',
        },
      ]);
    }
  }

  /**
   * Sanitize user input to prevent security issues
   */
  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeString(input);
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[this.sanitizeString(key)] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  /**
   * Validate file upload (if needed for import functionality)
   */
  validateFileUpload(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer?: Buffer;
  }): void {
    const errors: ValidationErrorDetail[] = [];

    // File size validation (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push({
        field: 'file.size',
        message: 'File size exceeds 10MB limit',
        value: file.size,
      });
    }

    // File type validation
    const allowedTypes = ['application/json', 'text/csv', 'application/csv', 'text/plain'];

    if (!allowedTypes.includes(file.mimetype)) {
      errors.push({
        field: 'file.mimetype',
        message: 'File type not allowed',
        value: file.mimetype,
      });
    }

    // Filename validation
    if (!this.isValidFilename(file.originalname)) {
      errors.push({
        field: 'file.originalname',
        message: 'Invalid filename',
        value: file.originalname,
      });
    }

    if (errors.length > 0) {
      throw new ValidationError('File upload validation failed', errors);
    }
  }

  /**
   * Validate pagination parameters
   */
  validatePagination(limit?: number, offset?: number): { limit: number; offset: number } {
    const validatedLimit = Math.min(Math.max(limit || 10, 1), 100);
    const validatedOffset = Math.max(offset || 0, 0);

    return { limit: validatedLimit, offset: validatedOffset };
  }

  /**
   * Validate and sanitize search query
   */
  validateSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      throw new ValidationError('Invalid query', [
        {
          field: 'query',
          message: 'Query must be a non-empty string',
        },
      ]);
    }

    const trimmed = query.trim();

    if (trimmed.length === 0) {
      throw new ValidationError('Empty query', [
        {
          field: 'query',
          message: 'Query cannot be empty',
        },
      ]);
    }

    if (trimmed.length > this.maxQueryLength) {
      throw new ValidationError('Query too long', [
        {
          field: 'query',
          message: `Query must be less than ${this.maxQueryLength} characters`,
          value: trimmed.length,
        },
      ]);
    }

    // Security validation
    this.checkForSQLInjection(trimmed);
    this.checkForXSS(trimmed);

    return this.sanitizeString(trimmed);
  }

  // Private validation methods

  private performSecurityValidation(data: any): void {
    // Check for common attack patterns
    const jsonString = JSON.stringify(data);

    // SQL injection check
    this.checkForSQLInjection(jsonString);

    // XSS check
    this.checkForXSS(jsonString);

    // Path traversal check
    this.checkForPathTraversal(jsonString);

    // Check for excessively large payloads
    if (jsonString.length > 10000) {
      // 10KB limit
      throw new ValidationError('Request too large', [
        {
          field: 'request',
          message: 'Request payload exceeds size limit',
          value: jsonString.length,
        },
      ]);
    }
  }

  private checkForSQLInjection(input: string): void {
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(input)) {
        throw new ValidationError('Potential SQL injection detected', [
          {
            field: 'input',
            message: 'Input contains potentially malicious SQL patterns',
            code: 'SQL_INJECTION',
          },
        ]);
      }
    }
  }

  private checkForXSS(input: string): void {
    for (const pattern of this.xssPatterns) {
      if (pattern.test(input)) {
        throw new ValidationError('Potential XSS detected', [
          {
            field: 'input',
            message: 'Input contains potentially malicious script patterns',
            code: 'XSS_DETECTED',
          },
        ]);
      }
    }
  }

  private checkForPathTraversal(input: string): void {
    const pathTraversalPatterns = [/\.\.\//g, /\.\.\\/g, /%2e%2e%2f/gi, /%2e%2e%5c/gi];

    for (const pattern of pathTraversalPatterns) {
      if (pattern.test(input)) {
        throw new ValidationError('Path traversal attempt detected', [
          {
            field: 'input',
            message: 'Input contains path traversal patterns',
            code: 'PATH_TRAVERSAL',
          },
        ]);
      }
    }
  }

  private sanitizeString(str: string): string {
    if (typeof str !== 'string') return str;

    return (
      str
        // Remove potential HTML/XML tags
        .replace(/<[^>]*>/g, '')
        // Remove potential script injections
        .replace(/javascript:/gi, '')
        // Remove SQL comment markers
        .replace(/--/g, '')
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        // Trim
        .trim()
    );
  }

  private validateBusinessRules(data: any): void {
    // Custom business rule validations
    if (data.options?.category && !this.allowedCategories.includes(data.options.category)) {
      throw new ValidationError('Invalid category', [
        {
          field: 'options.category',
          message: `Category must be one of: ${this.allowedCategories.join(', ')}`,
          value: data.options.category,
        },
      ]);
    }

    // Validate fuzzy threshold range
    if (data.options?.fuzzyThreshold !== undefined) {
      const threshold = data.options.fuzzyThreshold;
      if (threshold < 0.1 || threshold > 1.0) {
        throw new ValidationError('Invalid fuzzy threshold', [
          {
            field: 'options.fuzzyThreshold',
            message: 'Fuzzy threshold must be between 0.1 and 1.0',
            value: threshold,
          },
        ]);
      }
    }

    // Validate limit and offset combination
    if (data.options?.limit && data.options?.offset) {
      const maxResults = 1000; // Prevent excessive result sets
      if (data.options.limit + data.options.offset > maxResults) {
        throw new ValidationError('Result set too large', [
          {
            field: 'options',
            message: `Limit + offset cannot exceed ${maxResults}`,
            value: data.options.limit + data.options.offset,
          },
        ]);
      }
    }
  }

  private validateAutocompleteRateLimit(data: any): void {
    // Autocomplete specific validations
    if (data.q.length > 50) {
      throw new ValidationError('Autocomplete query too long', [
        {
          field: 'q',
          message: 'Autocomplete queries should be short for performance',
          value: data.q.length,
        },
      ]);
    }

    // Prevent autocomplete abuse with very short queries
    if (data.q.length === 1 && /[^a-zA-Z0-9]/.test(data.q)) {
      throw new ValidationError('Invalid autocomplete query', [
        {
          field: 'q',
          message: 'Single character queries must be alphanumeric',
          value: data.q,
        },
      ]);
    }
  }

  private isValidFilename(filename: string): boolean {
    // Check for valid filename patterns
    const validPattern = /^[a-zA-Z0-9._-]+\.(json|csv|txt)$/;
    return validPattern.test(filename) && filename.length <= 255;
  }

  private throwValidationError(message: string, issues: any[]): never {
    const details: ValidationErrorDetail[] = issues.map(issue => ({
      field: issue.path?.join('.') || 'unknown',
      message: issue.message,
      value: issue.received,
      code: issue.code,
    }));

    throw new ValidationError(message, details);
  }
}

/**
 * Middleware factory for request validation
 */
export function createValidationMiddleware(validator: RequestValidator) {
  return {
    validateSearch: (req: any, res: any, next: any) => {
      try {
        validator.validateSearchRequest(req.body);
        next();
      } catch (error) {
        if (error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: {
              message: error.message,
              code: error.code,
              details: error.details,
            },
          });
        } else {
          next(error);
        }
      }
    },

    validateAutocomplete: (req: any, res: any, next: any) => {
      try {
        validator.validateAutocompleteRequest(req.query);
        next();
      } catch (error) {
        if (error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: {
              message: error.message,
              code: error.code,
              details: error.details,
            },
          });
        } else {
          next(error);
        }
      }
    },

    validateHistory: (req: any, res: any, next: any) => {
      try {
        validator.validateHistoryRequest(req.query);
        next();
      } catch (error) {
        if (error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: {
              message: error.message,
              code: error.code,
              details: error.details,
            },
          });
        } else {
          next(error);
        }
      }
    },

    validateMetrics: (req: any, res: any, next: any) => {
      try {
        validator.validateMetricsRequest(req.query);
        next();
      } catch (error) {
        if (error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: {
              message: error.message,
              code: error.code,
              details: error.details,
            },
          });
        } else {
          next(error);
        }
      }
    },
  };
}

/**
 * Security-focused input sanitizer
 */
export class SecuritySanitizer {
  /**
   * Sanitize search query for database operations
   */
  static sanitizeSearchQuery(query: string): string {
    return query
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[;]/g, '') // Remove semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove SQL block comments
      .replace(/\*\//g, '')
      .trim()
      .substring(0, 500); // Limit length
  }

  /**
   * Sanitize user identifier
   */
  static sanitizeUserId(userId: string): string {
    // UUID format validation and sanitization
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(userId)) {
      throw new ValidationError('Invalid user ID format', [
        {
          field: 'userId',
          message: 'User ID must be a valid UUID',
          value: userId,
        },
      ]);
    }
    return userId.toLowerCase();
  }

  /**
   * Sanitize category selection
   */
  static sanitizeCategory(category: string): string {
    const allowedCategories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'];
    if (!allowedCategories.includes(category)) {
      throw new ValidationError('Invalid category', [
        {
          field: 'category',
          message: `Category must be one of: ${allowedCategories.join(', ')}`,
          value: category,
        },
      ]);
    }
    return category;
  }
}
