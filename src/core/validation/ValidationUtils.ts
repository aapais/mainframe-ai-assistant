import { ValidationRule, ValidationResult, ValidationContext } from './ValidationEngine';

/**
 * Common validation utility functions and rule builders
 * 
 * Provides reusable validation functions that can be combined to create
 * complex validation rules with minimal code duplication.
 */

/**
 * String validation utilities
 */
export class StringValidators {
  /**
   * Create a required string validation rule
   */
  static required(message?: string): ValidationRule<string> {
    return {
      name: 'required',
      validate: (value) => {
        const isValid = value != null && String(value).trim() !== '';
        return {
          isValid,
          errors: !isValid ? [{
            field: '',
            code: 'REQUIRED',
            message: message || 'This field is required',
            value
          }] : [],
          warnings: []
        };
      },
      errorMessage: message || 'This field is required'
    };
  }

  /**
   * Create a string length validation rule
   */
  static length(min?: number, max?: number, message?: string): ValidationRule<string> {
    return {
      name: 'length',
      validate: (value) => {
        const str = String(value || '');
        const length = str.length;
        
        let isValid = true;
        let errorMessage = '';

        if (min !== undefined && length < min) {
          isValid = false;
          errorMessage = `Must be at least ${min} characters`;
        } else if (max !== undefined && length > max) {
          isValid = false;
          errorMessage = `Must not exceed ${max} characters`;
        }

        if (!isValid && min !== undefined && max !== undefined) {
          errorMessage = `Must be between ${min} and ${max} characters`;
        }

        return {
          isValid,
          errors: !isValid ? [{
            field: '',
            code: 'LENGTH',
            message: message || `${errorMessage} (current: ${length})`,
            value,
            metadata: { min, max, current: length }
          }] : [],
          warnings: []
        };
      },
      errorMessage: message || (() => {
        if (min !== undefined && max !== undefined) {
          return `Must be between ${min} and ${max} characters`;
        } else if (min !== undefined) {
          return `Must be at least ${min} characters`;
        } else if (max !== undefined) {
          return `Must not exceed ${max} characters`;
        }
        return 'Invalid length';
      })()
    };
  }

  /**
   * Create a pattern matching validation rule
   */
  static pattern(regex: RegExp, message?: string): ValidationRule<string> {
    return {
      name: 'pattern',
      validate: (value) => {
        if (!value) return { isValid: true, errors: [], warnings: [] };
        
        const str = String(value);
        const isValid = regex.test(str);

        return {
          isValid,
          errors: !isValid ? [{
            field: '',
            code: 'PATTERN',
            message: message || 'Invalid format',
            value,
            metadata: { pattern: regex.source }
          }] : [],
          warnings: []
        };
      },
      errorMessage: message || 'Invalid format'
    };
  }

  /**
   * Create an enum validation rule
   */
  static enum<T extends string>(
    validValues: T[], 
    message?: string,
    caseSensitive: boolean = true
  ): ValidationRule<string> {
    return {
      name: 'enum',
      validate: (value) => {
        if (!value) return { isValid: true, errors: [], warnings: [] };
        
        const str = String(value);
        const compareValue = caseSensitive ? str : str.toLowerCase();
        const compareValues = caseSensitive ? validValues : validValues.map(v => v.toLowerCase());
        
        const isValid = compareValues.includes(compareValue as T);

        return {
          isValid,
          errors: !isValid ? [{
            field: '',
            code: 'INVALID_ENUM',
            message: message || `Must be one of: ${validValues.join(', ')}`,
            value,
            metadata: { validValues, caseSensitive }
          }] : [],
          warnings: []
        };
      },
      errorMessage: message || `Must be one of: ${validValues.join(', ')}`
    };
  }

  /**
   * Create a contains validation rule (checks if string contains specific substrings)
   */
  static contains(
    requiredTerms: string[], 
    mode: 'any' | 'all' = 'any',
    message?: string
  ): ValidationRule<string> {
    return {
      name: 'contains',
      validate: (value) => {
        if (!value) return { isValid: true, errors: [], warnings: [] };
        
        const str = String(value).toLowerCase();
        const matchedTerms = requiredTerms.filter(term => 
          str.includes(term.toLowerCase())
        );

        const isValid = mode === 'any' 
          ? matchedTerms.length > 0 
          : matchedTerms.length === requiredTerms.length;

        return {
          isValid,
          errors: !isValid ? [{
            field: '',
            code: 'MISSING_TERMS',
            message: message || `Must contain ${mode === 'any' ? 'at least one of' : 'all of'}: ${requiredTerms.join(', ')}`,
            value,
            metadata: { requiredTerms, mode, matched: matchedTerms }
          }] : [],
          warnings: []
        };
      },
      errorMessage: message || `Must contain required terms`
    };
  }

  /**
   * Create a structured text validation rule (checks for numbered steps, bullets, etc.)
   */
  static structured(message?: string): ValidationRule<string> {
    return {
      name: 'structured',
      validate: (value) => {
        if (!value) return { isValid: true, errors: [], warnings: [] };
        
        const str = String(value);
        const hasStructure = 
          /^\s*(\d+\.|\*|-|•)/.test(str) || // Starts with number/bullet
          /\n\s*(\d+\.|\*|-|•)/.test(str) || // Contains numbered/bulleted lines
          /^.+:\s*\n/.test(str); // Has headers with colons

        const warnings = !hasStructure ? [{
          field: '',
          code: 'UNSTRUCTURED',
          message: message || 'Consider using numbered steps or bullet points for better readability',
          suggestion: 'Format with 1., 2., 3... or • bullet points'
        }] : [];

        return {
          isValid: true, // This is a warning-only rule
          errors: [],
          warnings
        };
      },
      errorMessage: message || 'Should be structured with steps or bullets'
    };
  }

  /**
   * Create a mainframe-specific term validation rule
   */
  static mainframeTerms(message?: string): ValidationRule<string> {
    const mainframeTerms = [
      'JCL', 'VSAM', 'DB2', 'CICS', 'IMS', 'COBOL', 'TSO', 'ISPF', 'RACF',
      'S0C7', 'S0C4', 'SQLCODE', 'ABEND', 'STATUS', 'ERROR', 'IEF', 'WER',
      'DATASET', 'SYSOUT', 'SYSIN', 'DD', 'DSN', 'DISP', 'UNIT', 'VOL'
    ];

    return {
      name: 'mainframeTerms',
      validate: (value) => {
        if (!value) return { isValid: true, errors: [], warnings: [] };
        
        const str = String(value).toUpperCase();
        const hasMainframeTerms = mainframeTerms.some(term => 
          str.includes(term)
        );

        const warnings = !hasMainframeTerms ? [{
          field: '',
          code: 'NO_MAINFRAME_TERMS',
          message: message || 'Consider including specific mainframe terms (JCL, VSAM, error codes) for better categorization',
          suggestion: 'Add relevant mainframe terminology'
        }] : [];

        return {
          isValid: true, // This is a warning-only rule
          errors: [],
          warnings
        };
      },
      errorMessage: message || 'Should include mainframe-specific terminology'
    };
  }
}

/**
 * Array validation utilities
 */
export class ArrayValidators {
  /**
   * Create an array length validation rule
   */
  static length(min?: number, max?: number, message?: string): ValidationRule<any[]> {
    return {
      name: 'arrayLength',
      validate: (value) => {
        if (!Array.isArray(value)) {
          return {
            isValid: false,
            errors: [{
              field: '',
              code: 'NOT_ARRAY',
              message: 'Must be an array',
              value
            }],
            warnings: []
          };
        }

        const length = value.length;
        let isValid = true;
        let errorMessage = '';

        if (min !== undefined && length < min) {
          isValid = false;
          errorMessage = `Must have at least ${min} items`;
        } else if (max !== undefined && length > max) {
          isValid = false;
          errorMessage = `Must not have more than ${max} items`;
        }

        return {
          isValid,
          errors: !isValid ? [{
            field: '',
            code: 'ARRAY_LENGTH',
            message: message || `${errorMessage} (current: ${length})`,
            value,
            metadata: { min, max, current: length }
          }] : [],
          warnings: []
        };
      },
      errorMessage: message || 'Invalid array length'
    };
  }

  /**
   * Create a unique values validation rule
   */
  static unique(keyExtractor?: (item: any) => any, message?: string): ValidationRule<any[]> {
    return {
      name: 'unique',
      validate: (value) => {
        if (!Array.isArray(value)) {
          return { isValid: true, errors: [], warnings: [] };
        }

        const extract = keyExtractor || ((item) => String(item).toLowerCase());
        const seen = new Set();
        const duplicates: any[] = [];

        value.forEach((item, index) => {
          const key = extract(item);
          if (seen.has(key)) {
            duplicates.push({ item, index, key });
          } else {
            seen.add(key);
          }
        });

        const isValid = duplicates.length === 0;

        return {
          isValid,
          errors: !isValid ? [{
            field: '',
            code: 'DUPLICATE_VALUES',
            message: message || `Duplicate values found: ${duplicates.map(d => d.item).join(', ')}`,
            value,
            metadata: { duplicates }
          }] : [],
          warnings: []
        };
      },
      errorMessage: message || 'All values must be unique'
    };
  }

  /**
   * Create an item validation rule (validates each item in array)
   */
  static items(itemRule: ValidationRule, message?: string): ValidationRule<any[]> {
    return {
      name: 'arrayItems',
      async: true,
      validate: async (value, context) => {
        if (!Array.isArray(value)) {
          return { isValid: true, errors: [], warnings: [] };
        }

        const allErrors: any[] = [];
        const allWarnings: any[] = [];

        for (let i = 0; i < value.length; i++) {
          const itemResult = await itemRule.validate(value[i], context);
          
          // Add index information to errors/warnings
          itemResult.errors.forEach(error => {
            allErrors.push({
              ...error,
              message: `Item ${i + 1}: ${error.message}`,
              metadata: { ...error.metadata, index: i }
            });
          });

          itemResult.warnings.forEach(warning => {
            allWarnings.push({
              ...warning,
              message: `Item ${i + 1}: ${warning.message}`,
              metadata: { index: i }
            });
          });
        }

        return {
          isValid: allErrors.length === 0,
          errors: allErrors,
          warnings: allWarnings
        };
      },
      errorMessage: message || 'One or more items are invalid'
    };
  }
}

/**
 * Async validation utilities for database checks
 */
export class AsyncValidators {
  /**
   * Create a uniqueness check against database
   */
  static unique(
    checkFn: (value: any, context?: ValidationContext) => Promise<boolean>,
    message?: string
  ): ValidationRule {
    return {
      name: 'asyncUnique',
      async: true,
      validate: async (value, context) => {
        if (!value) return { isValid: true, errors: [], warnings: [] };
        
        try {
          const isUnique = await checkFn(value, context);
          
          return {
            isValid: isUnique,
            errors: !isUnique ? [{
              field: '',
              code: 'NOT_UNIQUE',
              message: message || `"${value}" already exists`,
              value
            }] : [],
            warnings: []
          };
        } catch (error) {
          return {
            isValid: false,
            errors: [{
              field: '',
              code: 'VALIDATION_ERROR',
              message: `Uniqueness check failed: ${error.message}`,
              value
            }],
            warnings: []
          };
        }
      },
      errorMessage: message || 'Value must be unique'
    };
  }

  /**
   * Create a custom async validation rule
   */
  static custom(
    validateFn: (value: any, context?: ValidationContext) => Promise<ValidationResult>,
    name: string = 'custom',
    message?: string
  ): ValidationRule {
    return {
      name,
      async: true,
      validate: validateFn,
      errorMessage: message || 'Custom validation failed'
    };
  }

  /**
   * Create AI-assisted validation (e.g., content quality check)
   */
  static aiQuality(
    aiCheckFn: (value: string) => Promise<{ score: number; feedback: string }>,
    threshold: number = 0.7,
    message?: string
  ): ValidationRule<string> {
    return {
      name: 'aiQuality',
      async: true,
      validate: async (value) => {
        if (!value || String(value).trim().length < 50) {
          return { isValid: true, errors: [], warnings: [] };
        }

        try {
          const result = await aiCheckFn(String(value));
          const warnings = result.score < threshold ? [{
            field: '',
            code: 'AI_QUALITY_LOW',
            message: message || `Content quality could be improved (score: ${Math.round(result.score * 100)}%)`,
            suggestion: result.feedback
          }] : [];

          return {
            isValid: true, // AI quality is warning-only
            errors: [],
            warnings
          };
        } catch (error) {
          // AI check failed, but don't fail validation
          return {
            isValid: true,
            errors: [],
            warnings: [{
              field: '',
              code: 'AI_CHECK_FAILED',
              message: 'AI quality check unavailable',
              suggestion: 'Review content manually for quality'
            }]
          };
        }
      },
      errorMessage: message || 'Content quality could be improved'
    };
  }
}

/**
 * Cross-field validation utilities
 */
export class CrossFieldValidators {
  /**
   * Create a dependency validation rule (field A requires field B)
   */
  static requires(
    dependentField: string,
    message?: string
  ): ValidationRule {
    return {
      name: 'requires',
      validate: (value, context) => {
        if (!value) return { isValid: true, errors: [], warnings: [] };
        
        const dependentValue = context?.entry?.[dependentField as keyof typeof context.entry];
        const isValid = dependentValue != null && String(dependentValue).trim() !== '';

        return {
          isValid,
          errors: !isValid ? [{
            field: dependentField,
            code: 'REQUIRED_DEPENDENCY',
            message: message || `${dependentField} is required when this field is provided`,
            value: dependentValue
          }] : [],
          warnings: []
        };
      },
      errorMessage: message || 'Required field is missing'
    };
  }

  /**
   * Create a relevance check between fields
   */
  static relevant(
    relatedField: string,
    similarityThreshold: number = 0.3,
    message?: string
  ): ValidationRule {
    return {
      name: 'relevant',
      validate: (value, context) => {
        if (!value || !context?.entry) {
          return { isValid: true, errors: [], warnings: [] };
        }

        const relatedValue = context.entry[relatedField as keyof typeof context.entry] as string;
        if (!relatedValue) {
          return { isValid: true, errors: [], warnings: [] };
        }

        const similarity = calculateTextSimilarity(String(value), String(relatedValue));
        const isRelevant = similarity >= similarityThreshold;

        const warnings = !isRelevant ? [{
          field: '',
          code: 'LOW_RELEVANCE',
          message: message || `Content may not be relevant to ${relatedField} (similarity: ${Math.round(similarity * 100)}%)`,
          suggestion: `Consider including keywords from ${relatedField}`
        }] : [];

        return {
          isValid: true, // Relevance is warning-only
          errors: [],
          warnings
        };
      },
      errorMessage: message || 'Content should be relevant to related field'
    };
  }
}

/**
 * Utility functions
 */

/**
 * Calculate text similarity between two strings (0-1)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Combine multiple validation rules into one
 */
export function combineRules(rules: ValidationRule[], name?: string): ValidationRule {
  return {
    name: name || 'combined',
    async: rules.some(rule => rule.async),
    validate: async (value, context) => {
      const allErrors: any[] = [];
      const allWarnings: any[] = [];

      for (const rule of rules) {
        const result = await rule.validate(value, context);
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
      }

      return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings
      };
    },
    errorMessage: 'Combined validation failed'
  };
}

/**
 * Create a conditional validation rule
 */
export function conditional(
  condition: (value: any, context?: ValidationContext) => boolean,
  rule: ValidationRule,
  name?: string
): ValidationRule {
  return {
    name: name || `conditional_${rule.name}`,
    async: rule.async,
    validate: async (value, context) => {
      if (!condition(value, context)) {
        return { isValid: true, errors: [], warnings: [] };
      }
      
      return await rule.validate(value, context);
    },
    errorMessage: rule.errorMessage
  };
}

/**
 * Debounce validation for real-time use
 */
export function debounceValidation<T>(
  validator: (value: T) => Promise<ValidationResult>,
  delay: number = 300
): (value: T) => Promise<ValidationResult> {
  let timeoutId: ReturnType<typeof setTimeout>;
  let latestValue: T;
  
  return (value: T): Promise<ValidationResult> => {
    latestValue = value;
    
    return new Promise((resolve) => {
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(async () => {
        if (latestValue === value) {
          const result = await validator(value);
          resolve(result);
        }
      }, delay);
    });
  };
}