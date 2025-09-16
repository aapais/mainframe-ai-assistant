/**
 * Comprehensive Validation System for Mainframe KB Assistant
 * 
 * This module provides a complete validation solution with:
 * - Synchronous and asynchronous validation
 * - Real-time validation with debouncing
 * - Schema-based validation
 * - Internationalization support
 * - Custom validation rules
 * - Performance optimization
 * 
 * @example
 * ```typescript
 * import { createValidator, StringValidators, RealTimeValidator } from './core/validation';
 * 
 * // Simple validation
 * const validator = createValidator();
 * const result = await validator.validateEntry(kbEntry);
 * 
 * // Real-time validation
 * const rtValidator = new RealTimeValidator({
 *   debounceMs: 300,
 *   validateOnChange: true
 * });
 * 
 * rtValidator.setupField('title', {
 *   rules: [StringValidators.required(), StringValidators.length(10, 200)]
 * });
 * 
 * // Schema validation
 * const schemaValidator = new SchemaValidator();
 * const result = await schemaValidator.validateKBEntryCreate(entry);
 * ```
 */

// Core validation engine
export {
  ValidationEngine,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidationRule,
  ValidationContext,
  FieldConfig
} from './ValidationEngine';

// Validation utilities and rule builders
export {
  StringValidators,
  ArrayValidators,
  AsyncValidators,
  CrossFieldValidators,
  calculateTextSimilarity,
  combineRules,
  conditional,
  debounceValidation
} from './ValidationUtils';

// Schema-based validation
export {
  SchemaValidator,
  ValidationSchema,
  PropertySchema
} from './SchemaValidator';

// Real-time validation with live feedback
export {
  RealTimeValidator,
  RealTimeValidationConfig,
  FieldValidationState,
  FormValidationState,
  ValidationEvent,
  createRealTimeValidator,
  useRealTimeValidation
} from './RealTimeValidator';

// Internationalization support
export {
  ValidationI18n,
  MessageTemplate,
  LanguagePack,
  I18nConfig,
  defaultI18nConfig,
  validationI18n,
  getValidationMessage,
  getContextualValidationMessage,
  withI18n,
  useValidationI18n
} from './ValidationI18n';

// Re-export KBEntry interface for convenience
export type { KBEntry } from '../../database/KnowledgeDB';

/**
 * Factory function to create a validation engine with default KB rules
 */
export function createValidator(locale: string = 'en'): ValidationEngine {
  return new ValidationEngine(locale);
}

/**
 * Factory function to create a schema validator with default schemas
 */
export function createSchemaValidator(engine?: ValidationEngine): SchemaValidator {
  return new SchemaValidator(engine);
}

/**
 * Factory function to create a complete validation suite
 */
export function createValidationSuite(locale: string = 'en') {
  const engine = createValidator(locale);
  const schemaValidator = createSchemaValidator(engine);
  const realTimeValidator = createRealTimeValidator({
    validateOnChange: true,
    validateOnBlur: true,
    autoSuggest: true
  });

  return {
    engine,
    schemaValidator,
    realTimeValidator,
    
    // Convenience methods
    validateEntry: (entry: any, context?: any) => engine.validateEntry(entry, context),
    validateField: (field: string, value: any, context?: any) => engine.validateField(field, value, context),
    validateWithSchema: (schema: string, data: any, context?: any) => schemaValidator.validateAgainstSchema(schema, data, context),
    
    // Real-time validation setup
    setupRealTimeValidation: (formElement: HTMLFormElement | any) => {
      // This would setup event listeners for real-time validation
      // Implementation depends on the UI framework being used
      return realTimeValidator;
    }
  };
}

/**
 * Pre-configured validation rules for common KB fields
 */
export const KBValidationRules = {
  title: [
    StringValidators.required('Title is required'),
    StringValidators.length(10, 200, 'Title must be between 10 and 200 characters'),
    StringValidators.mainframeTerms('Consider including mainframe-specific terminology')
  ],
  
  problem: [
    StringValidators.required('Problem description is required'),
    StringValidators.length(50, 5000, 'Problem description must be between 50 and 5000 characters'),
    StringValidators.structured('Consider formatting with numbered steps or bullets'),
    StringValidators.mainframeTerms('Include mainframe terminology and error codes when applicable')
  ],
  
  solution: [
    StringValidators.required('Solution is required'),
    StringValidators.length(50, 10000, 'Solution must be between 50 and 10000 characters'),
    StringValidators.structured('Format solution as clear, numbered steps'),
    StringValidators.contains(['verify', 'check', 'confirm'], 'any', 'Consider adding verification steps')
  ],
  
  category: [
    StringValidators.required('Category is required'),
    StringValidators.enum(
      ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'CICS', 'IMS', 'TSO/ISPF', 'RACF', 'System', 'Network', 'Other'],
      'Invalid category'
    )
  ],
  
  severity: [
    StringValidators.enum(
      ['critical', 'high', 'medium', 'low'],
      'Severity must be critical, high, medium, or low'
    )
  ],
  
  tags: [
    ArrayValidators.length(0, 20, 'Maximum 20 tags allowed'),
    ArrayValidators.unique(tag => String(tag).toLowerCase(), 'Tags must be unique'),
    ArrayValidators.items(
      StringValidators.pattern(/^[a-zA-Z0-9_-]+$/, 'Tags can only contain letters, numbers, hyphens, and underscores'),
      'Invalid tag format'
    )
  ]
};

/**
 * Validation presets for different scenarios
 */
export const ValidationPresets = {
  /**
   * Strict validation for production data
   */
  strict: {
    showWarningsAsErrors: true,
    enableAsyncValidation: true,
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 200
  },
  
  /**
   * Lenient validation for imports/migrations
   */
  lenient: {
    showWarningsAsErrors: false,
    enableAsyncValidation: false,
    validateOnChange: false,
    validateOnBlur: true,
    debounceMs: 500
  },
  
  /**
   * Real-time validation for user input
   */
  realTime: {
    showWarningsAsErrors: false,
    enableAsyncValidation: true,
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 300,
    autoSuggest: true,
    maxSuggestions: 3
  },
  
  /**
   * Batch validation for bulk operations
   */
  batch: {
    showWarningsAsErrors: false,
    enableAsyncValidation: false,
    validateOnChange: false,
    validateOnBlur: false,
    debounceMs: 0
  }
};

/**
 * Helper function to setup validation for a specific use case
 */
export function setupValidation(
  preset: keyof typeof ValidationPresets,
  customConfig?: Partial<RealTimeValidationConfig>,
  locale: string = 'en'
) {
  const config = {
    ...ValidationPresets[preset],
    ...customConfig
  };
  
  const engine = createValidator(locale);
  const schemaValidator = createSchemaValidator(engine);
  const realTimeValidator = new RealTimeValidator(config, engine);
  
  // Setup default KB field configurations
  Object.entries(KBValidationRules).forEach(([fieldName, rules]) => {
    realTimeValidator.setupField(fieldName, {
      rules,
      suggestions: config.autoSuggest
    });
  });
  
  return {
    engine,
    schemaValidator,
    realTimeValidator,
    config
  };
}

/**
 * Validation error formatter for different output formats
 */
export class ValidationErrorFormatter {
  static toJSON(result: ValidationResult): object {
    return {
      isValid: result.isValid,
      errors: result.errors.map(error => ({
        field: error.field,
        code: error.code,
        message: error.message,
        value: error.value,
        metadata: error.metadata
      })),
      warnings: result.warnings.map(warning => ({
        field: warning.field,
        code: warning.code,
        message: warning.message,
        suggestion: warning.suggestion
      }))
    };
  }
  
  static toHTML(result: ValidationResult): string {
    if (result.isValid) {
      return '<div class="validation-success">✓ All validations passed</div>';
    }
    
    const errors = result.errors.map(error => 
      `<div class="validation-error" data-field="${error.field}">
        <strong>${error.field}:</strong> ${error.message}
      </div>`
    ).join('');
    
    const warnings = result.warnings.map(warning => 
      `<div class="validation-warning" data-field="${warning.field}">
        <strong>${warning.field}:</strong> ${warning.message}
        ${warning.suggestion ? `<em>(${warning.suggestion})</em>` : ''}
      </div>`
    ).join('');
    
    return `<div class="validation-result">${errors}${warnings}</div>`;
  }
  
  static toText(result: ValidationResult): string {
    if (result.isValid) {
      return '✓ All validations passed';
    }
    
    const errors = result.errors.map(error => `✗ ${error.field}: ${error.message}`);
    const warnings = result.warnings.map(warning => `⚠ ${warning.field}: ${warning.message}`);
    
    return [...errors, ...warnings].join('\n');
  }
  
  static toMarkdown(result: ValidationResult): string {
    if (result.isValid) {
      return '✅ **All validations passed**';
    }
    
    const sections: string[] = [];
    
    if (result.errors.length > 0) {
      sections.push('## ❌ Errors\n');
      sections.push(...result.errors.map(error => 
        `- **${error.field}**: ${error.message}`
      ));
      sections.push('');
    }
    
    if (result.warnings.length > 0) {
      sections.push('## ⚠️ Warnings\n');
      sections.push(...result.warnings.map(warning => 
        `- **${warning.field}**: ${warning.message}${warning.suggestion ? ` _(${warning.suggestion})_` : ''}`
      ));
    }
    
    return sections.join('\n');
  }
}

/**
 * Performance monitoring for validation operations
 */
export class ValidationPerformanceMonitor {
  private static instance: ValidationPerformanceMonitor;
  private metrics: Map<string, ValidationMetric[]> = new Map();
  
  static getInstance(): ValidationPerformanceMonitor {
    if (!this.instance) {
      this.instance = new ValidationPerformanceMonitor();
    }
    return this.instance;
  }
  
  recordValidation(
    type: string,
    duration: number,
    success: boolean,
    errorCount: number = 0
  ): void {
    const metric: ValidationMetric = {
      type,
      duration,
      success,
      errorCount,
      timestamp: Date.now()
    };
    
    if (!this.metrics.has(type)) {
      this.metrics.set(type, []);
    }
    
    const typeMetrics = this.metrics.get(type)!;
    typeMetrics.push(metric);
    
    // Keep only last 1000 metrics per type
    if (typeMetrics.length > 1000) {
      typeMetrics.splice(0, typeMetrics.length - 1000);
    }
  }
  
  getPerformanceReport(type?: string): PerformanceReport {
    const targetTypes = type ? [type] : Array.from(this.metrics.keys());
    const allMetrics: ValidationMetric[] = [];
    
    targetTypes.forEach(t => {
      const typeMetrics = this.metrics.get(t) || [];
      allMetrics.push(...typeMetrics);
    });
    
    if (allMetrics.length === 0) {
      return {
        totalValidations: 0,
        averageDuration: 0,
        successRate: 0,
        errorRate: 0,
        performanceGrade: 'N/A'
      };
    }
    
    const totalValidations = allMetrics.length;
    const averageDuration = allMetrics.reduce((sum, m) => sum + m.duration, 0) / totalValidations;
    const successCount = allMetrics.filter(m => m.success).length;
    const successRate = successCount / totalValidations;
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const errorRate = totalErrors / totalValidations;
    
    let performanceGrade = 'Poor';
    if (averageDuration < 10 && successRate > 0.95) performanceGrade = 'Excellent';
    else if (averageDuration < 50 && successRate > 0.9) performanceGrade = 'Good';
    else if (averageDuration < 100 && successRate > 0.8) performanceGrade = 'Fair';
    
    return {
      totalValidations,
      averageDuration,
      successRate,
      errorRate,
      performanceGrade
    };
  }
}

// Supporting interfaces for performance monitoring
interface ValidationMetric {
  type: string;
  duration: number;
  success: boolean;
  errorCount: number;
  timestamp: number;
}

interface PerformanceReport {
  totalValidations: number;
  averageDuration: number;
  successRate: number;
  errorRate: number;
  performanceGrade: string;
}

/**
 * Default export with the most commonly used functionality
 */
export default {
  createValidator,
  createSchemaValidator,
  createValidationSuite,
  setupValidation,
  ValidationPresets,
  KBValidationRules,
  ValidationErrorFormatter,
  StringValidators,
  ArrayValidators,
  AsyncValidators,
  CrossFieldValidators,
  RealTimeValidator,
  ValidationEngine,
  SchemaValidator,
  ValidationI18n
};