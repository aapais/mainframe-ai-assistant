/**
 * Comprehensive Form Validation System
 * Provides reusable validation rules and schema-based validation
 */

export interface ValidationRule<T = any> {
  validate: (value: T, allValues?: Record<string, any>) => string | null;
  message?: string;
}

export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationRule[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  firstErrorField?: string;
}

export interface FormErrors {
  [key: string]: string | undefined;
}

/**
 * Built-in validation rules
 */
export const ValidationRules = {
  required: (message = 'This field is required'): ValidationRule => ({
    validate: (value) => {
      if (value === null || value === undefined || value === '') {
        return message;
      }
      if (typeof value === 'string' && value.trim() === '') {
        return message;
      }
      if (Array.isArray(value) && value.length === 0) {
        return message;
      }
      return null;
    }
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    validate: (value: string) => {
      if (typeof value !== 'string') return null;
      if (value.length < min) {
        return message || `Must be at least ${min} characters long`;
      }
      return null;
    }
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    validate: (value: string) => {
      if (typeof value !== 'string') return null;
      if (value.length > max) {
        return message || `Must be no more than ${max} characters long`;
      }
      return null;
    }
  }),

  pattern: (regex: RegExp, message: string): ValidationRule => ({
    validate: (value: string) => {
      if (typeof value !== 'string' || value === '') return null;
      if (!regex.test(value)) {
        return message;
      }
      return null;
    }
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    validate: (value: string) => {
      if (typeof value !== 'string' || value === '') return null;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return message;
      }
      return null;
    }
  }),

  arrayMinLength: (min: number, message?: string): ValidationRule => ({
    validate: (value: any[]) => {
      if (!Array.isArray(value)) return null;
      if (value.length < min) {
        return message || `Must have at least ${min} item${min > 1 ? 's' : ''}`;
      }
      return null;
    }
  }),

  // Custom validation for KB entries
  kbTitle: (): ValidationRule => ({
    validate: (value: string) => {
      if (typeof value !== 'string' || value.trim() === '') {
        return 'Title is required';
      }
      if (value.trim().length < 10) {
        return 'Title must be at least 10 characters long';
      }
      if (value.trim().length > 200) {
        return 'Title must be no more than 200 characters long';
      }
      return null;
    }
  }),

  kbProblem: (): ValidationRule => ({
    validate: (value: string) => {
      if (typeof value !== 'string' || value.trim() === '') {
        return 'Problem description is required';
      }
      if (value.trim().length < 20) {
        return 'Problem description must be at least 20 characters long';
      }
      if (value.trim().length > 5000) {
        return 'Problem description must be no more than 5000 characters long';
      }
      return null;
    }
  }),

  kbSolution: (): ValidationRule => ({
    validate: (value: string) => {
      if (typeof value !== 'string' || value.trim() === '') {
        return 'Solution is required';
      }
      if (value.trim().length < 20) {
        return 'Solution must be at least 20 characters long';
      }
      if (value.trim().length > 10000) {
        return 'Solution must be no more than 10000 characters long';
      }
      return null;
    }
  }),

  kbTags: (): ValidationRule => ({
    validate: (value: string[]) => {
      if (!Array.isArray(value)) return null;
      
      // Check for duplicate tags
      const uniqueTags = new Set(value.map(tag => tag.toLowerCase()));
      if (uniqueTags.size !== value.length) {
        return 'Duplicate tags are not allowed';
      }
      
      // Validate individual tags
      for (const tag of value) {
        if (typeof tag !== 'string' || tag.trim() === '') {
          return 'All tags must be non-empty strings';
        }
        if (tag.length > 30) {
          return 'Each tag must be no more than 30 characters long';
        }
        if (!/^[a-zA-Z0-9\-_]+$/.test(tag)) {
          return 'Tags can only contain letters, numbers, hyphens, and underscores';
        }
      }
      
      if (value.length > 10) {
        return 'Maximum 10 tags allowed';
      }
      
      return null;
    }
  }),

  conditional: (
    condition: (allValues: Record<string, any>) => boolean,
    rule: ValidationRule,
    message?: string
  ): ValidationRule => ({
    validate: (value, allValues) => {
      if (condition(allValues || {})) {
        return rule.validate(value, allValues);
      }
      return null;
    }
  })
};

/**
 * Validate a single field with multiple rules
 */
export function validateField(
  value: any, 
  rules: ValidationRule | ValidationRule[], 
  allValues?: Record<string, any>
): string | null {
  const ruleArray = Array.isArray(rules) ? rules : [rules];
  
  for (const rule of ruleArray) {
    const error = rule.validate(value, allValues);
    if (error) return error;
  }
  
  return null;
}

/**
 * Validate entire form against schema
 */
export function validateForm(
  values: Record<string, any>, 
  schema: ValidationSchema
): ValidationResult {
  const errors: Record<string, string> = {};
  let firstErrorField: string | undefined;
  
  for (const [field, rules] of Object.entries(schema)) {
    const error = validateField(values[field], rules, values);
    if (error) {
      errors[field] = error;
      if (!firstErrorField) {
        firstErrorField = field;
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    firstErrorField
  };
}

/**
 * Create a validation schema for KB entries
 */
export function createKBEntryValidationSchema(mode: 'create' | 'edit' = 'create'): ValidationSchema {
  return {
    title: ValidationRules.kbTitle(),
    problem: ValidationRules.kbProblem(),
    solution: ValidationRules.kbSolution(),
    category: ValidationRules.required('Please select a category'),
    tags: ValidationRules.kbTags()
  };
}

/**
 * Real-time validation debouncing
 */
export function createDebouncedValidator(
  schema: ValidationSchema,
  delay = 300
) {
  let timeoutId: NodeJS.Timeout;
  
  return (
    values: Record<string, any>,
    callback: (result: ValidationResult) => void
  ) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      const result = validateForm(values, schema);
      callback(result);
    }, delay);
  };
}

/**
 * Error message helpers
 */
export const ErrorMessages = {
  network: 'Network error. Please check your connection and try again.',
  server: 'Server error. Please try again later.',
  validation: 'Please correct the highlighted fields.',
  duplicate: 'An entry with this title already exists.',
  unauthorized: 'You do not have permission to perform this action.',
  unknown: 'An unexpected error occurred. Please try again.',
  
  getFieldError: (field: string, errors: FormErrors): string | undefined => {
    return errors[field];
  },
  
  hasErrors: (errors: FormErrors): boolean => {
    return Object.values(errors).some(error => error !== undefined);
  },
  
  getFirstError: (errors: FormErrors): string | undefined => {
    return Object.values(errors).find(error => error !== undefined);
  }
};

/**
 * Form state management utilities
 */
export interface FormState<T = Record<string, any>> {
  values: T;
  errors: FormErrors;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
}

export function createInitialFormState<T extends Record<string, any>>(
  initialValues: T
): FormState<T> {
  return {
    values: { ...initialValues },
    errors: {},
    touched: {},
    isSubmitting: false,
    isDirty: false,
    isValid: false
  };
}