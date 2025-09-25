import { KBEntry } from '../../database/KnowledgeDB';

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  field?: string;
}

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: any;
  metadata?: Record<string, any>;
}

/**
 * Validation warning interface
 */
export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  suggestion?: string;
  value?: any;
}

/**
 * Validation rule interface
 */
export interface ValidationRule<T = any> {
  name: string;
  validate: (value: T, context?: ValidationContext) => Promise<ValidationResult> | ValidationResult;
  errorMessage: string | ((value: T, context?: ValidationContext) => string);
  async?: boolean;
}

/**
 * Validation context for contextual rules
 */
export interface ValidationContext {
  entry?: Partial<KBEntry>;
  existingEntries?: KBEntry[];
  user?: string;
  operation?: 'create' | 'update' | 'delete';
  metadata?: Record<string, any>;
}

/**
 * Field configuration for validation
 */
export interface FieldConfig {
  name: string;
  rules: ValidationRule[];
  optional?: boolean;
  dependencies?: string[];
}

/**
 * Main validation engine class
 *
 * Provides comprehensive validation capabilities for KB entries with:
 * - Synchronous and asynchronous validation support
 * - Field-level and cross-field validation
 * - Custom error messaging with i18n support
 * - Context-aware validation rules
 * - Performance-optimized execution
 *
 * @example
 * ```typescript
 * const validator = new ValidationEngine();
 *
 * // Simple validation
 * const result = await validator.validateEntry(entry);
 * if (!result.isValid) {
 *   console.log('Validation errors:', result.errors);
 * }
 *
 * // Field-specific validation
 * const titleResult = await validator.validateField('title', entry.title);
 *
 * // Real-time validation with context
 * const contextResult = await validator.validateWithContext(entry, {
 *   operation: 'create',
 *   user: 'john.doe'
 * });
 * ```
 */
export class ValidationEngine {
  private fieldConfigs: Map<string, FieldConfig> = new Map();
  private globalRules: ValidationRule[] = [];
  private locale: string = 'en';
  private messageTemplates: Map<string, string> = new Map();

  constructor(locale: string = 'en') {
    this.locale = locale;
    this.initializeDefaultRules();
    this.initializeMessageTemplates();
  }

  /**
   * Register a field configuration with validation rules
   */
  registerField(config: FieldConfig): void {
    this.fieldConfigs.set(config.name, config);
  }

  /**
   * Register a global validation rule that applies to all entries
   */
  registerGlobalRule(rule: ValidationRule): void {
    this.globalRules.push(rule);
  }

  /**
   * Validate a complete KB entry
   */
  async validateEntry(
    entry: Partial<KBEntry>,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate each configured field
    for (const [fieldName, fieldConfig] of this.fieldConfigs) {
      if (!fieldConfig.optional && !(fieldName in entry)) {
        errors.push({
          field: fieldName,
          code: 'REQUIRED_FIELD',
          message: this.getMessage('REQUIRED_FIELD', { field: fieldName }),
          value: undefined,
        });
        continue;
      }

      const fieldValue = (entry as any)[fieldName];
      if (fieldValue !== undefined) {
        const fieldResult = await this.validateField(fieldName, fieldValue, { ...context, entry });
        errors.push(...fieldResult.errors);
        warnings.push(...fieldResult.warnings);
      }
    }

    // Run global validation rules
    for (const rule of this.globalRules) {
      const result = await this.executeRule(rule, entry, context);
      if (!result.isValid) {
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
    }

    // Cross-field validation
    const crossFieldResult = await this.validateCrossFields(entry, context);
    errors.push(...crossFieldResult.errors);
    warnings.push(...crossFieldResult.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a specific field value
   */
  async validateField(
    fieldName: string,
    value: any,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const fieldConfig = this.fieldConfigs.get(fieldName);
    if (!fieldConfig) {
      return { isValid: true, errors: [], warnings: [] };
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Execute all rules for this field
    for (const rule of fieldConfig.rules) {
      const result = await this.executeRule(rule, value, context, fieldName);
      if (!result.isValid) {
        errors.push(...result.errors.map(error => ({ ...error, field: fieldName })));
        warnings.push(...result.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      field: fieldName,
    };
  }

  /**
   * Validate with full context (for real-time validation)
   */
  async validateWithContext(
    entry: Partial<KBEntry>,
    context: ValidationContext
  ): Promise<ValidationResult> {
    return this.validateEntry(entry, context);
  }

  /**
   * Get validation schema as JSON (for client-side validation)
   */
  getValidationSchema(): Record<string, any> {
    const schema: Record<string, any> = {};

    for (const [fieldName, fieldConfig] of this.fieldConfigs) {
      schema[fieldName] = {
        required: !fieldConfig.optional,
        rules: fieldConfig.rules.map(rule => ({
          name: rule.name,
          errorMessage:
            typeof rule.errorMessage === 'string' ? rule.errorMessage : 'Custom validation rule',
        })),
      };
    }

    return schema;
  }

  /**
   * Batch validate multiple entries
   */
  async validateBatch(
    entries: Partial<KBEntry>[],
    context?: ValidationContext
  ): Promise<ValidationResult[]> {
    const results = await Promise.all(entries.map(entry => this.validateEntry(entry, context)));
    return results;
  }

  /**
   * Execute a single validation rule
   */
  private async executeRule(
    rule: ValidationRule,
    value: any,
    context?: ValidationContext,
    fieldName?: string
  ): Promise<ValidationResult> {
    try {
      const result = await rule.validate(value, context);

      // Enhance error messages if they're functions
      if (!result.isValid && result.errors.length > 0) {
        result.errors = result.errors.map(error => ({
          ...error,
          message:
            typeof rule.errorMessage === 'function'
              ? rule.errorMessage(value, context)
              : error.message || rule.errorMessage,
          field: fieldName || error.field,
        }));
      }

      return result;
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            field: fieldName || 'unknown',
            code: 'VALIDATION_ERROR',
            message: `Validation rule '${rule.name}' failed: ${error.message}`,
            value,
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Cross-field validation (e.g., solution must reference problem keywords)
   */
  private async validateCrossFields(
    entry: Partial<KBEntry>,
    context?: ValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Example: Solution should contain at least one keyword from problem
    if (entry.problem && entry.solution) {
      const problemKeywords = this.extractKeywords(entry.problem);
      const solutionText = entry.solution.toLowerCase();

      const hasRelevantKeywords = problemKeywords.some(keyword =>
        solutionText.includes(keyword.toLowerCase())
      );

      if (!hasRelevantKeywords && problemKeywords.length > 0) {
        warnings.push({
          field: 'solution',
          code: 'SOLUTION_RELEVANCE',
          message: this.getMessage('SOLUTION_RELEVANCE', {
            keywords: problemKeywords.slice(0, 3).join(', '),
          }),
          suggestion: 'Consider including relevant keywords from the problem description',
        });
      }
    }

    // Category-specific validation
    if (entry.category && entry.tags) {
      const categoryLower = entry.category.toLowerCase();
      const categoryTag = entry.tags.find(tag => tag.toLowerCase() === categoryLower);

      if (!categoryTag) {
        warnings.push({
          field: 'tags',
          code: 'MISSING_CATEGORY_TAG',
          message: this.getMessage('MISSING_CATEGORY_TAG', { category: entry.category }),
          suggestion: `Consider adding '${entry.category.toLowerCase()}' as a tag`,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Extract keywords from text for relevance checking
   */
  private extractKeywords(text: string): string[] {
    // Common mainframe terms that should be preserved
    const importantTerms = [
      'JCL',
      'VSAM',
      'DB2',
      'CICS',
      'IMS',
      'COBOL',
      'TSO',
      'ISPF',
      'S0C7',
      'S0C4',
      'SQLCODE',
      'ABEND',
      'STATUS',
      'ERROR',
    ];

    const words = text
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 2);

    // Include important terms and longer words
    const keywords = words.filter(
      word => importantTerms.some(term => word.toUpperCase().includes(term)) || word.length > 4
    );

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Get localized message from template
   */
  private getMessage(code: string, params?: Record<string, any>): string {
    const template = this.messageTemplates.get(code) || code;

    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  /**
   * Initialize default validation rules for KB entries
   */
  private initializeDefaultRules(): void {
    // Title field validation
    this.registerField({
      name: 'title',
      rules: [
        {
          name: 'required',
          validate: value => ({
            isValid: value != null && String(value).trim() !== '',
            errors: !value
              ? [
                  {
                    field: 'title',
                    code: 'REQUIRED',
                    message: 'Title is required',
                  },
                ]
              : [],
            warnings: [],
          }),
          errorMessage: 'Title is required',
        },
        {
          name: 'length',
          validate: value => {
            const str = String(value || '').trim();
            const isValid = str.length >= 10 && str.length <= 200;
            return {
              isValid,
              errors: !isValid
                ? [
                    {
                      field: 'title',
                      code: 'LENGTH',
                      message: `Title must be between 10 and 200 characters (current: ${str.length})`,
                    },
                  ]
                : [],
              warnings: [],
            };
          },
          errorMessage: value => {
            const len = String(value || '').trim().length;
            return `Title must be between 10 and 200 characters (current: ${len})`;
          },
        },
        {
          name: 'descriptive',
          validate: value => {
            const str = String(value || '')
              .trim()
              .toLowerCase();
            const hasKeywords = /\b(error|status|issue|problem|abend|fail|exception)\b/.test(str);
            const warnings = !hasKeywords
              ? [
                  {
                    field: 'title',
                    code: 'TITLE_DESCRIPTIVE',
                    message:
                      'Consider including descriptive keywords like "error", "status", or "issue"',
                    suggestion: 'Make the title more descriptive for better searchability',
                  },
                ]
              : [];

            return {
              isValid: true,
              errors: [],
              warnings,
            };
          },
          errorMessage: 'Title should be more descriptive',
        },
      ],
    });

    // Problem field validation
    this.registerField({
      name: 'problem',
      rules: [
        {
          name: 'required',
          validate: value => ({
            isValid: value != null && String(value).trim() !== '',
            errors: !value
              ? [
                  {
                    field: 'problem',
                    code: 'REQUIRED',
                    message: 'Problem description is required',
                  },
                ]
              : [],
            warnings: [],
          }),
          errorMessage: 'Problem description is required',
        },
        {
          name: 'minLength',
          validate: value => {
            const str = String(value || '').trim();
            const isValid = str.length >= 50;
            return {
              isValid,
              errors: !isValid
                ? [
                    {
                      field: 'problem',
                      code: 'MIN_LENGTH',
                      message: `Problem description must be at least 50 characters (current: ${str.length})`,
                    },
                  ]
                : [],
              warnings: [],
            };
          },
          errorMessage: value => {
            const len = String(value || '').trim().length;
            return `Problem description must be at least 50 characters (current: ${len})`;
          },
        },
        {
          name: 'structure',
          validate: value => {
            const str = String(value || '').trim();
            const warnings: ValidationWarning[] = [];

            // Check for error codes
            const hasErrorCode = /\b[A-Z]\d{3,4}[A-Z]?|S\d{3}[A-Z]?|\w+CODE\s*-?\d+\b/i.test(str);
            if (!hasErrorCode) {
              warnings.push({
                field: 'problem',
                code: 'NO_ERROR_CODE',
                message:
                  'Consider including error codes (S0C7, IEF212I, SQLCODE, etc.) for better searchability',
                suggestion: 'Include specific error codes when available',
              });
            }

            // Check for context information
            const hasContext = /\b(when|during|after|while|program|job|system)\b/i.test(str);
            if (!hasContext) {
              warnings.push({
                field: 'problem',
                code: 'LACKS_CONTEXT',
                message: 'Consider adding context about when/where the problem occurs',
                suggestion: 'Describe the circumstances when this problem happens',
              });
            }

            return {
              isValid: true,
              errors: [],
              warnings,
            };
          },
          errorMessage: 'Problem description should include error codes and context',
        },
      ],
    });

    // Solution field validation
    this.registerField({
      name: 'solution',
      rules: [
        {
          name: 'required',
          validate: value => ({
            isValid: value != null && String(value).trim() !== '',
            errors: !value
              ? [
                  {
                    field: 'solution',
                    code: 'REQUIRED',
                    message: 'Solution is required',
                  },
                ]
              : [],
            warnings: [],
          }),
          errorMessage: 'Solution is required',
        },
        {
          name: 'structured',
          validate: value => {
            const str = String(value || '').trim();
            const hasSteps = /^\s*(\d+\.|\*|-|•)/.test(str) || /\n\s*(\d+\.|\*|-|•)/.test(str);
            const warnings = !hasSteps
              ? [
                  {
                    field: 'solution',
                    code: 'UNSTRUCTURED_SOLUTION',
                    message: 'Consider formatting solution as numbered steps for clarity',
                    suggestion:
                      'Use numbered steps (1., 2., 3.) or bullet points for better readability',
                  },
                ]
              : [];

            return {
              isValid: true,
              errors: [],
              warnings,
            };
          },
          errorMessage: 'Solution should be formatted with clear steps',
        },
        {
          name: 'completeness',
          validate: value => {
            const str = String(value || '').trim();
            const hasVerification = /\b(verify|check|confirm|test|validate)\b/i.test(str);
            const warnings =
              !hasVerification && str.length > 100
                ? [
                    {
                      field: 'solution',
                      code: 'NO_VERIFICATION',
                      message:
                        'Consider including verification steps to confirm the solution worked',
                      suggestion: 'Add steps to verify that the problem has been resolved',
                    },
                  ]
                : [];

            return {
              isValid: true,
              errors: [],
              warnings,
            };
          },
          errorMessage: 'Solution should include verification steps',
        },
      ],
    });

    // Category field validation
    this.registerField({
      name: 'category',
      rules: [
        {
          name: 'required',
          validate: value => ({
            isValid: value != null && String(value).trim() !== '',
            errors: !value
              ? [
                  {
                    field: 'category',
                    code: 'REQUIRED',
                    message: 'Category is required',
                  },
                ]
              : [],
            warnings: [],
          }),
          errorMessage: 'Category is required',
        },
        {
          name: 'validEnum',
          validate: value => {
            const validCategories = [
              'JCL',
              'VSAM',
              'DB2',
              'Batch',
              'Functional',
              'CICS',
              'IMS',
              'TSO/ISPF',
              'RACF',
              'System',
              'Network',
              'Other',
            ];
            const str = String(value || '').trim();
            const isValid = validCategories.includes(str);

            if (!isValid && str) {
              // Suggest closest match
              const suggestion = this.findClosestMatch(str, validCategories);
              return {
                isValid: false,
                errors: [
                  {
                    field: 'category',
                    code: 'INVALID_CATEGORY',
                    message: `Invalid category "${str}". Valid categories: ${validCategories.join(', ')}`,
                    metadata: { suggestion, validCategories },
                  },
                ],
                warnings: [],
              };
            }

            return {
              isValid,
              errors: [],
              warnings: [],
            };
          },
          errorMessage: value => {
            const validCategories = [
              'JCL',
              'VSAM',
              'DB2',
              'Batch',
              'Functional',
              'CICS',
              'IMS',
              'TSO/ISPF',
              'RACF',
              'System',
              'Network',
              'Other',
            ];
            return `Category must be one of: ${validCategories.join(', ')}`;
          },
        },
      ],
    });

    // Tags field validation
    this.registerField({
      name: 'tags',
      optional: true,
      rules: [
        {
          name: 'arrayFormat',
          validate: value => {
            if (!value) return { isValid: true, errors: [], warnings: [] };

            const isArray = Array.isArray(value);
            return {
              isValid: isArray,
              errors: !isArray
                ? [
                    {
                      field: 'tags',
                      code: 'INVALID_FORMAT',
                      message: 'Tags must be provided as an array of strings',
                    },
                  ]
                : [],
              warnings: [],
            };
          },
          errorMessage: 'Tags must be an array',
        },
        {
          name: 'uniqueValues',
          validate: value => {
            if (!Array.isArray(value)) return { isValid: true, errors: [], warnings: [] };

            const tags = value.map(tag => String(tag).toLowerCase().trim());
            const uniqueTags = [...new Set(tags)];
            const hasDuplicates = tags.length !== uniqueTags.length;

            return {
              isValid: !hasDuplicates,
              errors: hasDuplicates
                ? [
                    {
                      field: 'tags',
                      code: 'DUPLICATE_TAGS',
                      message: 'Tags must be unique (case insensitive)',
                    },
                  ]
                : [],
              warnings: [],
            };
          },
          errorMessage: 'Tags must be unique',
        },
        {
          name: 'tagFormat',
          validate: value => {
            if (!Array.isArray(value)) return { isValid: true, errors: [], warnings: [] };

            const errors: ValidationError[] = [];
            const warnings: ValidationWarning[] = [];

            value.forEach((tag, index) => {
              const tagStr = String(tag).trim();

              // Check length
              if (tagStr.length < 2) {
                errors.push({
                  field: 'tags',
                  code: 'TAG_TOO_SHORT',
                  message: `Tag "${tagStr}" is too short (minimum 2 characters)`,
                  metadata: { index, tag: tagStr },
                });
              } else if (tagStr.length > 30) {
                errors.push({
                  field: 'tags',
                  code: 'TAG_TOO_LONG',
                  message: `Tag "${tagStr}" is too long (maximum 30 characters)`,
                  metadata: { index, tag: tagStr },
                });
              }

              // Check format (alphanumeric, hyphens, underscores only)
              if (!/^[a-zA-Z0-9_-]+$/.test(tagStr)) {
                errors.push({
                  field: 'tags',
                  code: 'INVALID_TAG_FORMAT',
                  message: `Tag "${tagStr}" contains invalid characters. Use only letters, numbers, hyphens, and underscores`,
                  metadata: { index, tag: tagStr },
                });
              }

              // Suggest lowercase
              if (tagStr !== tagStr.toLowerCase()) {
                warnings.push({
                  field: 'tags',
                  code: 'TAG_CASE',
                  message: `Tag "${tagStr}" should be lowercase for consistency`,
                  suggestion: `Use "${tagStr.toLowerCase()}" instead`,
                });
              }
            });

            return {
              isValid: errors.length === 0,
              errors,
              warnings,
            };
          },
          errorMessage: 'Tags must be 2-30 characters, alphanumeric with hyphens/underscores only',
        },
      ],
    });

    // Severity field validation
    this.registerField({
      name: 'severity',
      optional: true,
      rules: [
        {
          name: 'validEnum',
          validate: value => {
            if (!value) return { isValid: true, errors: [], warnings: [] };

            const validSeverities = ['critical', 'high', 'medium', 'low'];
            const str = String(value).toLowerCase().trim();
            const isValid = validSeverities.includes(str);

            return {
              isValid,
              errors: !isValid
                ? [
                    {
                      field: 'severity',
                      code: 'INVALID_SEVERITY',
                      message: `Severity must be one of: ${validSeverities.join(', ')}`,
                    },
                  ]
                : [],
              warnings: [],
            };
          },
          errorMessage: 'Severity must be: critical, high, medium, or low',
        },
      ],
    });
  }

  /**
   * Initialize localized message templates
   */
  private initializeMessageTemplates(): void {
    // English templates
    this.messageTemplates.set('REQUIRED_FIELD', '{field} is required');
    this.messageTemplates.set(
      'SOLUTION_RELEVANCE',
      'Solution might not be relevant to the problem. Consider including keywords: {keywords}'
    );
    this.messageTemplates.set(
      'MISSING_CATEGORY_TAG',
      'Consider adding "{category}" as a tag to match the category'
    );
  }

  /**
   * Find closest string match for suggestions
   */
  private findClosestMatch(input: string, candidates: string[]): string | undefined {
    const inputLower = input.toLowerCase();
    let bestMatch = '';
    let bestScore = 0;

    for (const candidate of candidates) {
      const candidateLower = candidate.toLowerCase();
      const score = this.calculateSimilarity(inputLower, candidateLower);

      if (score > bestScore && score > 0.3) {
        // Minimum similarity threshold
        bestMatch = candidate;
        bestScore = score;
      }
    }

    return bestMatch || undefined;
  }

  /**
   * Calculate string similarity (0-1)
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.8;

    // Simple character overlap calculation
    const setA = new Set(a.toLowerCase());
    const setB = new Set(b.toLowerCase());
    const intersection = new Set([...setA].filter(char => setB.has(char)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }
}
