import { z, ZodError } from 'zod';
import { KBEntry } from '../KnowledgeDB';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sanitizedData?: any;
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
}

/**
 * Validation warning details
 */
export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  value?: any;
}

/**
 * Sanitization options
 */
export interface SanitizationOptions {
  trimStrings?: boolean;
  normalizeWhitespace?: boolean;
  removeHtmlTags?: boolean;
  maxLength?: { [field: string]: number };
  allowedTags?: string[];
}

/**
 * Custom validation rule
 */
export interface ValidationRule {
  field: string;
  validator: (value: any, data: any) => boolean | string;
  message: string;
  level: 'error' | 'warning';
}

/**
 * Knowledge Base Entry Schema
 */
export const KBEntrySchema = z.object({
  id: z.string().uuid().optional(),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters long')
    .max(200, 'Title cannot exceed 200 characters')
    .regex(/^[a-zA-Z0-9\s\-_:()/.]+$/, 'Title contains invalid characters'),

  problem: z
    .string()
    .min(20, 'Problem description must be at least 20 characters long')
    .max(5000, 'Problem description cannot exceed 5000 characters'),

  solution: z
    .string()
    .min(20, 'Solution must be at least 20 characters long')
    .max(10000, 'Solution cannot exceed 10000 characters'),

  category: z
    .enum(['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'TSO', 'Other'])
    .refine(val => val !== undefined, 'Category is required'),

  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),

  tags: z
    .array(z.string().min(2).max(30))
    .max(10, 'Maximum 10 tags allowed')
    .optional()
    .transform(tags => tags?.map(tag => tag.toLowerCase().trim()))
    .refine(tags => {
      if (!tags) return true;
      const unique = new Set(tags);
      return unique.size === tags.length;
    }, 'Duplicate tags are not allowed'),

  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  created_by: z.string().max(100).optional(),
  usage_count: z.number().int().min(0).optional(),
  success_count: z.number().int().min(0).optional(),
  failure_count: z.number().int().min(0).optional(),
});

/**
 * Search Query Schema
 */
export const SearchQuerySchema = z.object({
  query: z
    .string()
    .min(2, 'Search query must be at least 2 characters long')
    .max(1000, 'Search query cannot exceed 1000 characters'),

  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

/**
 * User Input Schema
 */
export const UserInputSchema = z.object({
  userId: z.string().min(1).max(100),
  sessionId: z.string().min(1).max(200).optional(),
  action: z.enum(['search', 'view', 'rate', 'create', 'update', 'delete']),
  timestamp: z.date().optional(),
});

/**
 * Comprehensive Data Validator
 *
 * Provides validation, sanitization, and business rule enforcement
 * for all database operations.
 *
 * @example
 * ```typescript
 * const validator = new DataValidator();
 *
 * // Validate and sanitize KB entry
 * const result = await validator.validateKBEntry({
 *   title: 'VSAM Status 35',
 *   problem: 'File not found error...',
 *   solution: 'Check if file exists...',
 *   category: 'VSAM',
 *   tags: ['vsam', 'status-35']
 * });
 *
 * if (result.valid) {
 *   // Use result.sanitizedData for database insert
 *   await db.insert(result.sanitizedData);
 * } else {
 *   // Handle validation errors
 *   console.log(result.errors);
 * }
 * ```
 */
export class DataValidator {
  private customRules: ValidationRule[] = [];
  private sanitizationOptions: SanitizationOptions = {
    trimStrings: true,
    normalizeWhitespace: true,
    removeHtmlTags: true,
    maxLength: {
      title: 200,
      problem: 5000,
      solution: 10000,
    },
  };

  constructor(options?: {
    customRules?: ValidationRule[];
    sanitizationOptions?: Partial<SanitizationOptions>;
  }) {
    if (options?.customRules) {
      this.customRules = options.customRules;
    }

    if (options?.sanitizationOptions) {
      this.sanitizationOptions = { ...this.sanitizationOptions, ...options.sanitizationOptions };
    }

    this.initializeDefaultRules();
  }

  /**
   * Validate Knowledge Base entry
   */
  async validateKBEntry(data: Partial<KBEntry>): Promise<ValidationResult> {
    try {
      // Sanitize input data
      const sanitizedData = this.sanitizeData(data, [
        'title',
        'problem',
        'solution',
        'category',
        'created_by',
      ]);

      // Schema validation
      const validatedData = KBEntrySchema.parse(sanitizedData);

      // Business rules validation
      const businessValidation = await this.validateBusinessRules(validatedData, 'kb_entry');

      return {
        valid: businessValidation.errors.length === 0,
        errors: businessValidation.errors,
        warnings: businessValidation.warnings,
        sanitizedData: validatedData,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: this.formatZodErrors(error),
          warnings: [],
        };
      }

      return {
        valid: false,
        errors: [
          {
            field: 'unknown',
            code: 'VALIDATION_ERROR',
            message: error.message || 'Unknown validation error',
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Validate search query
   */
  async validateSearchQuery(data: any): Promise<ValidationResult> {
    try {
      const sanitizedData = this.sanitizeData(data, ['query', 'category']);
      const validatedData = SearchQuerySchema.parse(sanitizedData);

      // Additional search-specific validations
      const warnings: ValidationWarning[] = [];

      // Check for potentially slow queries
      if (validatedData.query.length < 3) {
        warnings.push({
          field: 'query',
          code: 'SHORT_QUERY',
          message: 'Short queries may return too many results',
          value: validatedData.query,
        });
      }

      // Check for SQL injection attempts
      const suspiciousPatterns = [';', '--', '/*', '*/', 'DROP', 'DELETE', 'UPDATE'];
      const hasSuspiciousContent = suspiciousPatterns.some(pattern =>
        validatedData.query.toUpperCase().includes(pattern.toUpperCase())
      );

      if (hasSuspiciousContent) {
        return {
          valid: false,
          errors: [
            {
              field: 'query',
              code: 'SUSPICIOUS_CONTENT',
              message: 'Query contains potentially unsafe content',
            },
          ],
          warnings: [],
        };
      }

      return {
        valid: true,
        errors: [],
        warnings,
        sanitizedData: validatedData,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: this.formatZodErrors(error),
          warnings: [],
        };
      }

      return {
        valid: false,
        errors: [
          {
            field: 'unknown',
            code: 'VALIDATION_ERROR',
            message: error.message || 'Unknown validation error',
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Validate user input for logging/tracking
   */
  async validateUserInput(data: any): Promise<ValidationResult> {
    try {
      const sanitizedData = this.sanitizeData(data, ['userId', 'sessionId']);
      const validatedData = UserInputSchema.parse(sanitizedData);

      return {
        valid: true,
        errors: [],
        warnings: [],
        sanitizedData: validatedData,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          errors: this.formatZodErrors(error),
          warnings: [],
        };
      }

      return {
        valid: false,
        errors: [
          {
            field: 'unknown',
            code: 'VALIDATION_ERROR',
            message: error.message || 'Unknown validation error',
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Sanitize input data
   */
  private sanitizeData(data: any, stringFields: string[]): any {
    const sanitized = { ...data };

    for (const field of stringFields) {
      if (sanitized[field] && typeof sanitized[field] === 'string') {
        let value = sanitized[field];

        // Trim whitespace
        if (this.sanitizationOptions.trimStrings) {
          value = value.trim();
        }

        // Normalize whitespace
        if (this.sanitizationOptions.normalizeWhitespace) {
          value = value.replace(/\s+/g, ' ');
        }

        // Remove HTML tags
        if (this.sanitizationOptions.removeHtmlTags) {
          value = this.stripHtmlTags(value);
        }

        // Enforce max length
        const maxLength = this.sanitizationOptions.maxLength?.[field];
        if (maxLength && value.length > maxLength) {
          value = value.substring(0, maxLength);
        }

        sanitized[field] = value;
      }
    }

    return sanitized;
  }

  /**
   * Strip HTML tags while preserving allowed tags
   */
  private stripHtmlTags(input: string): string {
    if (!input) return input;

    // Remove script and style elements completely
    const withoutScripts = input.replace(/<(script|style)[^>]*>.*?<\/\1>/gis, '');

    // Remove HTML tags but preserve content
    const withoutTags = withoutScripts.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    return withoutTags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * Validate business rules
   */
  private async validateBusinessRules(
    data: any,
    context: string
  ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Apply custom rules
    for (const rule of this.customRules) {
      if (data[rule.field] !== undefined) {
        const result = rule.validator(data[rule.field], data);

        if (result === false || (typeof result === 'string' && result.length > 0)) {
          const error = {
            field: rule.field,
            code: 'BUSINESS_RULE_VIOLATION',
            message: typeof result === 'string' ? result : rule.message,
            value: data[rule.field],
          };

          if (rule.level === 'error') {
            errors.push(error);
          } else {
            warnings.push(error);
          }
        }
      }
    }

    // Context-specific business rules
    if (context === 'kb_entry') {
      // Check for duplicate titles (would need database access)
      // This is a placeholder for business logic

      // Validate category-specific requirements
      if (data.category === 'DB2' && data.solution && !data.solution.includes('SQL')) {
        warnings.push({
          field: 'solution',
          code: 'CATEGORY_MISMATCH',
          message: 'DB2 solutions typically include SQL commands',
        });
      }

      // Check for common error patterns in problem description
      if (data.problem && data.category === 'JCL') {
        const jclKeywords = ['JOB', 'EXEC', 'DD', 'DSN'];
        const hasJclKeywords = jclKeywords.some(keyword =>
          data.problem.toUpperCase().includes(keyword)
        );

        if (!hasJclKeywords) {
          warnings.push({
            field: 'problem',
            code: 'MISSING_KEYWORDS',
            message: 'JCL problems typically mention JOB, EXEC, DD, or DSN',
          });
        }
      }
    }

    return { errors, warnings };
  }

  /**
   * Format Zod validation errors
   */
  private formatZodErrors(zodError: ZodError): ValidationError[] {
    return zodError.errors.map(error => ({
      field: error.path.join('.'),
      code: error.code,
      message: error.message,
      value: error.received,
    }));
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // Add default business rules
    this.customRules.push(
      {
        field: 'tags',
        validator: (tags: string[]) => {
          if (!tags) return true;

          // Check for offensive content (basic implementation)
          const offensiveWords = ['damn', 'shit']; // Expand as needed
          const hasOffensive = tags.some(tag =>
            offensiveWords.some(word => tag.toLowerCase().includes(word))
          );

          return !hasOffensive;
        },
        message: 'Tags contain inappropriate content',
        level: 'error',
      },
      {
        field: 'solution',
        validator: (solution: string) => {
          if (!solution) return true;

          // Check if solution has actionable steps
          const actionWords = ['check', 'verify', 'run', 'execute', 'modify', 'update'];
          const hasActionWords = actionWords.some(word => solution.toLowerCase().includes(word));

          return hasActionWords || 'Solution should contain actionable steps';
        },
        message: 'Solution should include actionable steps',
        level: 'warning',
      },
      {
        field: 'problem',
        validator: (problem: string) => {
          if (!problem) return true;

          // Check for error codes or specific symptoms
          const errorPatterns = [
            /S0C\d/i, // System completion codes
            /U\d{4}/i, // User completion codes
            /IEF\d{3}[A-Z]/i, // JES2 messages
            /SQLCODE/i, // DB2 errors
            /status \d+/i, // VSAM status
          ];

          const hasErrorPattern = errorPatterns.some(pattern => pattern.test(problem));

          return hasErrorPattern || 'Consider including specific error codes or messages';
        },
        message: 'Problems with specific error codes are more useful',
        level: 'warning',
      }
    );
  }

  /**
   * Add custom validation rule
   */
  addRule(rule: ValidationRule): void {
    this.customRules.push(rule);
  }

  /**
   * Remove custom validation rule
   */
  removeRule(field: string, code?: string): void {
    this.customRules = this.customRules.filter(rule => {
      if (code) {
        return !(rule.field === field && rule.message.includes(code));
      }
      return rule.field !== field;
    });
  }

  /**
   * Update sanitization options
   */
  setSanitizationOptions(options: Partial<SanitizationOptions>): void {
    this.sanitizationOptions = { ...this.sanitizationOptions, ...options };
  }

  /**
   * Get validation statistics
   */
  getValidationStats(): {
    totalRules: number;
    errorRules: number;
    warningRules: number;
    customRules: number;
  } {
    return {
      totalRules: this.customRules.length,
      errorRules: this.customRules.filter(r => r.level === 'error').length,
      warningRules: this.customRules.filter(r => r.level === 'warning').length,
      customRules: this.customRules.length,
    };
  }
}

/**
 * Input sanitizer utility class
 */
export class InputSanitizer {
  /**
   * Clean and validate SQL identifiers (table names, column names)
   */
  static sanitizeSqlIdentifier(identifier: string): string {
    if (!identifier) throw new Error('Identifier cannot be empty');

    // Only allow alphanumeric characters, underscores, and hyphens
    const cleaned = identifier.replace(/[^a-zA-Z0-9_-]/g, '');

    if (cleaned.length === 0) {
      throw new Error('Identifier contains no valid characters');
    }

    if (cleaned.length > 64) {
      throw new Error('Identifier too long (max 64 characters)');
    }

    // Ensure it doesn't start with a number
    if (/^\d/.test(cleaned)) {
      throw new Error('Identifier cannot start with a number');
    }

    return cleaned;
  }

  /**
   * Sanitize file paths
   */
  static sanitizeFilePath(filePath: string): string {
    if (!filePath) throw new Error('File path cannot be empty');

    // Remove potentially dangerous characters
    let cleaned = filePath.replace(/[<>:"|?*]/g, '');

    // Prevent directory traversal
    cleaned = cleaned.replace(/\.\./g, '');

    // Normalize path separators
    cleaned = cleaned.replace(/[/\\]+/g, '/');

    return cleaned;
  }

  /**
   * Validate and sanitize email addresses
   */
  static sanitizeEmail(email: string): string {
    if (!email) throw new Error('Email cannot be empty');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmed = email.trim().toLowerCase();

    if (!emailRegex.test(trimmed)) {
      throw new Error('Invalid email format');
    }

    return trimmed;
  }

  /**
   * Sanitize user-provided text content
   */
  static sanitizeTextContent(
    content: string,
    options: {
      maxLength?: number;
      allowHtml?: boolean;
      preserveLineBreaks?: boolean;
    } = {}
  ): string {
    if (!content) return '';

    let sanitized = content.trim();

    // Remove HTML if not allowed
    if (!options.allowHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Normalize whitespace but preserve line breaks if requested
    if (options.preserveLineBreaks) {
      sanitized = sanitized.replace(/[ \t]+/g, ' ');
    } else {
      sanitized = sanitized.replace(/\s+/g, ' ');
    }

    // Enforce max length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }
}
