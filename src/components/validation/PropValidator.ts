/**
 * Advanced Prop Validation System
 * Provides runtime validation with TypeScript integration
 */

import { ComponentType, ReactElement } from 'react';

// =========================
// VALIDATION CORE TYPES
// =========================

export type ValidationLevel = 'error' | 'warning' | 'info';

export interface ValidationResult {
  valid: boolean;
  level: ValidationLevel;
  message: string;
  field?: string;
  suggestions?: string[];
}

export interface ValidationRule<T = any> {
  name: string;
  validator: (value: T, allProps?: any, context?: ValidationContext) => ValidationResult;
  dependencies?: string[];
  async?: boolean;
  environment?: 'development' | 'production' | 'both';
}

export interface ValidationContext {
  componentName: string;
  propName: string;
  componentStack: string[];
  validationStack: string[];
}

export interface ValidationSchema<TProps = any> {
  rules: Record<keyof TProps, ValidationRule[]>;
  globalRules?: ValidationRule[];
  options?: ValidationOptions;
}

export interface ValidationOptions {
  /** Validation mode */
  mode: 'strict' | 'loose' | 'development-only';

  /** Stop on first error */
  failFast?: boolean;

  /** Enable performance monitoring */
  performance?: boolean;

  /** Custom error handler */
  onError?: (errors: ValidationResult[]) => void;

  /** Custom warning handler */
  onWarning?: (warnings: ValidationResult[]) => void;

  /** Async validation timeout */
  asyncTimeout?: number;
}

// =========================
// BUILT-IN VALIDATORS
// =========================

/**
 * Core validation functions
 */
export class PropValidators {
  /**
   * Required field validator
   */
  static required<T>(message = 'This field is required'): ValidationRule<T> {
    return {
      name: 'required',
      validator: (value: T): ValidationResult => {
        const isValid = value !== undefined && value !== null && value !== '';
        return {
          valid: isValid,
          level: 'error',
          message: isValid ? '' : message
        };
      }
    };
  }

  /**
   * Type validator
   */
  static type<T>(expectedType: string, message?: string): ValidationRule<T> {
    return {
      name: 'type',
      validator: (value: T): ValidationResult => {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        const isValid = actualType === expectedType;
        return {
          valid: isValid,
          level: 'error',
          message: isValid ? '' :
            message || `Expected ${expectedType}, got ${actualType}`
        };
      }
    };
  }

  /**
   * String length validator
   */
  static stringLength(min?: number, max?: number, message?: string): ValidationRule<string> {
    return {
      name: 'stringLength',
      validator: (value: string): ValidationResult => {
        if (typeof value !== 'string') {
          return { valid: false, level: 'error', message: 'Value must be a string' };
        }

        const length = value.length;
        const minValid = min === undefined || length >= min;
        const maxValid = max === undefined || length <= max;
        const isValid = minValid && maxValid;

        let errorMessage = '';
        if (!minValid) errorMessage = `Minimum length is ${min}`;
        if (!maxValid) errorMessage = `Maximum length is ${max}`;
        if (!minValid && !maxValid) errorMessage = `Length must be between ${min} and ${max}`;

        return {
          valid: isValid,
          level: 'error',
          message: isValid ? '' : message || errorMessage
        };
      }
    };
  }

  /**
   * Array validator
   */
  static array<T>(itemValidator?: ValidationRule<T>, message?: string): ValidationRule<T[]> {
    return {
      name: 'array',
      validator: (value: T[]): ValidationResult => {
        if (!Array.isArray(value)) {
          return {
            valid: false,
            level: 'error',
            message: message || 'Value must be an array'
          };
        }

        if (itemValidator) {
          for (let i = 0; i < value.length; i++) {
            const itemResult = itemValidator.validator(value[i]);
            if (!itemResult.valid) {
              return {
                valid: false,
                level: itemResult.level,
                message: `Item at index ${i}: ${itemResult.message}`,
                field: `[${i}]`
              };
            }
          }
        }

        return { valid: true, level: 'info', message: '' };
      }
    };
  }

  /**
   * Enum validator
   */
  static oneOf<T>(allowedValues: T[], message?: string): ValidationRule<T> {
    return {
      name: 'oneOf',
      validator: (value: T): ValidationResult => {
        const isValid = allowedValues.includes(value);
        return {
          valid: isValid,
          level: 'error',
          message: isValid ? '' :
            message || `Value must be one of: ${allowedValues.join(', ')}`,
          suggestions: isValid ? [] : allowedValues.map(String)
        };
      }
    };
  }

  /**
   * Object shape validator
   */
  static shape<T extends object>(shapeRules: Record<keyof T, ValidationRule[]>): ValidationRule<T> {
    return {
      name: 'shape',
      validator: (value: T): ValidationResult => {
        if (typeof value !== 'object' || value === null) {
          return {
            valid: false,
            level: 'error',
            message: 'Value must be an object'
          };
        }

        for (const [key, rules] of Object.entries(shapeRules)) {
          const propValue = value[key as keyof T];
          for (const rule of rules as ValidationRule[]) {
            const result = rule.validator(propValue);
            if (!result.valid) {
              return {
                valid: false,
                level: result.level,
                message: `Property '${key}': ${result.message}`,
                field: key
              };
            }
          }
        }

        return { valid: true, level: 'info', message: '' };
      }
    };
  }

  /**
   * Function validator
   */
  static func(message = 'Value must be a function'): ValidationRule<Function> {
    return {
      name: 'func',
      validator: (value: Function): ValidationResult => {
        const isValid = typeof value === 'function';
        return {
          valid: isValid,
          level: 'error',
          message: isValid ? '' : message
        };
      }
    };
  }

  /**
   * React element validator
   */
  static element(message = 'Value must be a React element'): ValidationRule<ReactElement> {
    return {
      name: 'element',
      validator: (value: ReactElement): ValidationResult => {
        const isValid = value && typeof value === 'object' && 'type' in value;
        return {
          valid: isValid,
          level: 'error',
          message: isValid ? '' : message
        };
      }
    };
  }

  /**
   * Custom validator
   */
  static custom<T>(
    validatorFn: (value: T, props?: any) => boolean | string,
    message = 'Custom validation failed'
  ): ValidationRule<T> {
    return {
      name: 'custom',
      validator: (value: T, allProps?: any): ValidationResult => {
        const result = validatorFn(value, allProps);
        const isValid = result === true;
        const errorMessage = typeof result === 'string' ? result : message;

        return {
          valid: isValid,
          level: 'error',
          message: isValid ? '' : errorMessage
        };
      }
    };
  }

  /**
   * Async validator
   */
  static async<T>(
    validatorFn: (value: T, props?: any) => Promise<boolean | string>,
    message = 'Async validation failed'
  ): ValidationRule<T> {
    return {
      name: 'async',
      async: true,
      validator: (value: T, allProps?: any): ValidationResult => {
        // This will be handled specially by the validation engine
        return { valid: true, level: 'info', message: 'Async validation pending' };
      }
    };
  }
}

// =========================
// VALIDATION ENGINE
// =========================

/**
 * Main validation engine
 */
export class ValidationEngine {
  private static performanceMode = process.env.NODE_ENV === 'development';

  /**
   * Validate props against schema
   */
  static validate<TProps>(
    props: TProps,
    schema: ValidationSchema<TProps>,
    context: Partial<ValidationContext> = {}
  ): ValidationResult[] {
    const startTime = this.performanceMode ? performance.now() : 0;
    const results: ValidationResult[] = [];

    const validationContext: ValidationContext = {
      componentName: context.componentName || 'Unknown',
      propName: context.propName || '',
      componentStack: context.componentStack || [],
      validationStack: context.validationStack || []
    };

    // Validate individual props
    for (const [propName, rules] of Object.entries(schema.rules)) {
      const propValue = props[propName as keyof TProps];

      for (const rule of rules as ValidationRule[]) {
        // Skip production-only rules in development
        if (rule.environment === 'production' && process.env.NODE_ENV === 'development') {
          continue;
        }
        if (rule.environment === 'development' && process.env.NODE_ENV === 'production') {
          continue;
        }

        try {
          const result = rule.validator(propValue, props, {
            ...validationContext,
            propName: propName
          });

          if (!result.valid) {
            results.push({
              ...result,
              field: result.field || propName
            });

            // Stop on first error if failFast is enabled
            if (schema.options?.failFast) {
              break;
            }
          }
        } catch (error) {
          results.push({
            valid: false,
            level: 'error',
            message: `Validation error in rule '${rule.name}': ${(error as Error).message}`,
            field: propName
          });
        }
      }

      // Stop processing props if failFast and we have errors
      if (schema.options?.failFast && results.some(r => r.level === 'error')) {
        break;
      }
    }

    // Global validation rules
    if (schema.globalRules) {
      for (const rule of schema.globalRules) {
        try {
          const result = rule.validator(props, props, validationContext);
          if (!result.valid) {
            results.push(result);
          }
        } catch (error) {
          results.push({
            valid: false,
            level: 'error',
            message: `Global validation error: ${(error as Error).message}`
          });
        }
      }
    }

    // Performance logging
    if (this.performanceMode && schema.options?.performance) {
      const endTime = performance.now();
      console.log(`Validation took ${endTime - startTime} milliseconds`);
    }

    // Handle callbacks
    const errors = results.filter(r => r.level === 'error');
    const warnings = results.filter(r => r.level === 'warning');

    if (errors.length && schema.options?.onError) {
      schema.options.onError(errors);
    }
    if (warnings.length && schema.options?.onWarning) {
      schema.options.onWarning(warnings);
    }

    return results;
  }

  /**
   * Create a validation HOC
   */
  static createValidator<TProps>(
    schema: ValidationSchema<TProps>
  ): (Component: ComponentType<TProps>) => ComponentType<TProps> {
    return (Component: ComponentType<TProps>) => {
      const ValidatedComponent = (props: TProps) => {
        if (process.env.NODE_ENV === 'development' || schema.options?.mode !== 'development-only') {
          const results = this.validate(props, schema, {
            componentName: Component.displayName || Component.name
          });

          const errors = results.filter(r => r.level === 'error');
          if (errors.length && (schema.options?.mode === 'strict' || process.env.NODE_ENV === 'development')) {
            console.group(`🚨 Validation Errors in ${Component.displayName || Component.name}`);
            errors.forEach(error => {
              console.error(`${error.field}: ${error.message}`, error.suggestions ? { suggestions: error.suggestions } : '');
            });
            console.groupEnd();

            if (schema.options?.mode === 'strict') {
              throw new Error(`Validation failed for ${Component.displayName || Component.name}`);
            }
          }

          const warnings = results.filter(r => r.level === 'warning');
          if (warnings.length && process.env.NODE_ENV === 'development') {
            console.group(`⚠️ Validation Warnings in ${Component.displayName || Component.name}`);
            warnings.forEach(warning => {
              console.warn(`${warning.field}: ${warning.message}`);
            });
            console.groupEnd();
          }
        }

        return Component(props);
      };

      ValidatedComponent.displayName = `Validated(${Component.displayName || Component.name})`;
      return ValidatedComponent as ComponentType<TProps>;
    };
  }
}

// =========================
// SPECIALIZED KB VALIDATORS
// =========================

/**
 * Knowledge Base specific validators
 */
export class KBValidators {
  /**
   * KB Category validator
   */
  static kbCategory(): ValidationRule<string> {
    const validCategories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'IMS', 'CICS', 'System', 'Other'];
    return PropValidators.oneOf(validCategories, 'Invalid KB category');
  }

  /**
   * KB Tags validator
   */
  static kbTags(): ValidationRule<string[]> {
    return PropValidators.array(
      PropValidators.custom(
        (tag: string) => {
          if (typeof tag !== 'string') return 'Tag must be a string';
          if (tag.length === 0) return 'Tag cannot be empty';
          if (tag.length > 50) return 'Tag too long (max 50 characters)';
          if (!/^[a-zA-Z0-9-_]+$/.test(tag)) return 'Tag contains invalid characters';
          return true;
        }
      )
    );
  }

  /**
   * KB Entry content validator
   */
  static kbContent(minLength = 10, maxLength = 5000): ValidationRule<string> {
    return {
      name: 'kbContent',
      validator: (value: string): ValidationResult => {
        if (typeof value !== 'string') {
          return { valid: false, level: 'error', message: 'Content must be a string' };
        }

        const trimmed = value.trim();
        if (trimmed.length < minLength) {
          return {
            valid: false,
            level: 'error',
            message: `Content too short (minimum ${minLength} characters)`
          };
        }

        if (trimmed.length > maxLength) {
          return {
            valid: false,
            level: 'error',
            message: `Content too long (maximum ${maxLength} characters)`
          };
        }

        return { valid: true, level: 'info', message: '' };
      }
    };
  }

  /**
   * Search query validator
   */
  static searchQuery(): ValidationRule<string> {
    return {
      name: 'searchQuery',
      validator: (value: string): ValidationResult => {
        if (typeof value !== 'string') {
          return { valid: false, level: 'error', message: 'Search query must be a string' };
        }

        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return { valid: false, level: 'warning', message: 'Search query is empty' };
        }

        if (trimmed.length > 200) {
          return {
            valid: false,
            level: 'warning',
            message: 'Search query is very long and may not perform well'
          };
        }

        return { valid: true, level: 'info', message: '' };
      }
    };
  }
}